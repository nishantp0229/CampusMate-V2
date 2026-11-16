// WebRTC peer manager. Signaling is sent and polled through validated RPCs.
//
// Dual-consent flow:
// 1. User A clicks "Request Video" -> sends a validated 'video_request'
// 2. User B receives 'video_request' -> UI prompts User B to Accept or Decline
// 3. If User B accepts -> both acquire local media, negotiate peer connection via SDP offer/answer + ICE candidates
// 4. Either user can mute mic, disable camera, or end call at any time without terminating the text chat

import { getIceServers } from './anonymous.js'

export class AnonymousWebRTC {
  constructor({
    roomId,
    supabase,
    onRemoteStream,
    onCallStateChange,
    onError,
    onRoomEnded,
  }) {
    this.roomId = roomId
    this.supabase = supabase
    this.onRemoteStream = onRemoteStream
    this.onCallStateChange = onCallStateChange
    this.onError = onError
    this.onRoomEnded = onRoomEnded

    this.peerConnection = null
    this.localStream = null
    this.remoteStream = null
    this.sessionId = null
    this.signalCursor = 0
    this.polling = false
    this.destroyed = false
    this.generation = 0
    this.pendingIce = []
    this.pendingOutgoingIce = []
    this.canSendIce = false
    this.isInitiator = false
    this.callState = 'idle' // idle | requesting | incoming_request | connecting | connected | ended
    this.connectTimeout = null

    this._initSignaling()
  }

  _startConnectTimeout() {
    this._clearConnectTimeout()
    // 15-second connection timeout for NAT traversal / STUN resolution
    this.connectTimeout = setTimeout(() => {
      if (this.callState === 'connecting' || this.callState === 'requesting') {
        console.warn('WebRTC connection timed out (likely symmetric NAT/firewall).')
        this.endCall()
        if (this.onError) {
          this.onError(
            'Direct video connection timed out (NAT/firewall restriction). Text chat is still active.'
          )
        }
      }
    }, 15000)
  }

  _clearConnectTimeout() {
    if (this.connectTimeout) {
      clearTimeout(this.connectTimeout)
      this.connectTimeout = null
    }
  }

  _setCallState(newState) {
    this.callState = newState
    if (this.onCallStateChange) {
      this.onCallStateChange(newState)
    }
  }

  _initSignaling() {
    if (!this.supabase || !this.roomId) return
    this.pollTimer = setInterval(() => void this._pollSignals(), 1500)
    void this._pollSignals()
  }

  async _sendSignal(event, payload = {}, sessionId = this.sessionId) {
    if (this.destroyed) throw new Error('Signaling has stopped.')
    const { data, error } = await this.supabase.rpc('anonymous_send_signal', {
      p_room_id: this.roomId,
      p_session_id: sessionId,
      p_event: event,
      p_payload: payload,
    })
    if (error) throw error
    return data
  }

  async _pollSignals() {
    if (this.destroyed || this.polling || (this.callState === 'requesting' && !this.sessionId)) return
    this.polling = true
    const generation = this.generation
    try {
      const { data, error } = await this.supabase.rpc('anonymous_poll_signals', {
        p_room_id: this.roomId,
        p_after_id: this.signalCursor,
      })
      if (error) throw error
      if (this.destroyed || generation !== this.generation) return
      if (data?.room_active === false) {
        this.destroy()
        this.onRoomEnded?.()
        return
      }
      // A reloaded tab cannot safely resume a peer connection it no longer
      // owns. Close that server session before allowing a new call.
      if (this.callState === 'idle' && !this.sessionId && data?.session_id &&
          ['accepted', 'offered', 'connected'].includes(data.session_status)) {
        await this._sendSignal('video_end', {}, data.session_id)
        return
      }
      for (const signal of data?.events || []) {
        if (this.destroyed) break
        this.signalCursor = Math.max(this.signalCursor, Number(signal.id) || 0)
        if (signal.session_id !== data.session_id) continue
        if (signal.event === 'video_request') {
          if (this.callState === 'idle' && data.session_status === 'requested') {
            this.sessionId = signal.session_id
            this.isInitiator = false
            this._setCallState('incoming_request')
          }
          continue
        }
        if (!this.sessionId || signal.session_id !== this.sessionId) continue
        if (signal.event === 'video_accept' && this.callState === 'requesting' && this.isInitiator) {
          this._setCallState('connecting')
          void this._startAsCaller()
        } else if (signal.event === 'video_reject' && this.callState === 'requesting') {
          this._finishCall()
          this.onError?.('Partner declined the video call request.')
        } else if (signal.event === 'video_offer' && this.callState === 'connecting' && !this.isInitiator) {
          void this._handleOffer(signal.payload)
        } else if (signal.event === 'video_answer' && this.callState === 'connecting' && this.isInitiator) {
          await this._handleAnswer(signal.payload)
        } else if (signal.event === 'video_ice' && ['connecting', 'connected'].includes(this.callState)) {
          await this._handleIceCandidate(signal.payload)
        } else if (signal.event === 'video_end') {
          this._finishCall()
        }
      }
    } catch (err) {
      console.warn('Signaling poll failed:', err.message)
    } finally {
      this.polling = false
    }
  }

  _finishCall() {
    this.cleanupMedia()
    this.sessionId = null
    if (!this.destroyed) this._setCallState('idle')
  }

  // Caller sends request to partner
  async requestCall() {
    if (this.destroyed || this.callState !== 'idle') return
    this.isInitiator = true
    this._setCallState('requesting')
    const generation = this.generation
    try {
      const data = await this._sendSignal('video_request', {}, null)
      if (this.destroyed || generation !== this.generation) {
        // The request may have committed after the user canceled locally.
        // Best-effort cancellation prevents leaving an orphaned request.
        if (data?.session_id) {
          void Promise.resolve(this.supabase.rpc('anonymous_send_signal', {
            p_room_id: this.roomId,
            p_session_id: data.session_id,
            p_event: 'video_end',
            p_payload: {},
          })).catch(() => {})
        }
        return
      }
      this.sessionId = data.session_id
      this._startConnectTimeout()
    } catch (err) {
      if (this.destroyed || generation !== this.generation) return
      this._finishCall()
      this.onError?.(`Could not request video: ${err.message}`)
    }
  }

  // Callee accepts request
  async acceptCall() {
    if (this.destroyed || this.callState !== 'incoming_request' || !this.sessionId) return
    this.isInitiator = false
    this._setCallState('connecting')
    this._startConnectTimeout()
    const generation = this.generation

    try {
      // Server validates the active room and call before camera access.
      this.mediaReady = (async () => {
        await this._sendSignal('video_accept')
        await this._acquireLocalMedia(generation)
        if (!this.destroyed && generation === this.generation) this._createPeerConnection()
      })()
      await this.mediaReady
    } catch (err) {
      console.error('Camera/mic access error:', err)
      if (this.destroyed || generation !== this.generation) return
      this.endCall()
      if (this.onError) {
        this.onError(`Camera/microphone access failed: ${err.message || 'Permission denied'}`)
      }
    }
  }

  // Callee rejects request
  rejectCall() {
    if (this.callState !== 'incoming_request' || !this.sessionId) return
    void this._sendSignal('video_reject').catch((err) => console.warn('Reject failed:', err.message))
    this._finishCall()
  }

  // End active video call
  endCall() {
    if (this.sessionId) {
      void this._sendSignal('video_end').catch((err) => console.warn('End call failed:', err.message))
    }
    this._finishCall()
  }

  async _startAsCaller() {
    this._startConnectTimeout()
    const generation = this.generation
    try {
      await this._acquireLocalMedia(generation)
      if (this.destroyed || generation !== this.generation) return
      this._createPeerConnection()

      const offer = await this.peerConnection.createOffer()
      if (this.destroyed || generation !== this.generation) return
      await this.peerConnection.setLocalDescription(offer)
      if (this.destroyed || generation !== this.generation) return
      await this._sendSignal('video_offer', { sdp: offer.sdp, type: offer.type })
      if (this.destroyed || generation !== this.generation) return
      this._flushOutgoingIce()
    } catch (err) {
      console.error('Caller setup error:', err)
      if (this.destroyed || generation !== this.generation) return
      this.endCall()
      if (this.onError) {
        this.onError(`Video connection failed: ${err.message}`)
      }
    }
  }

  async _handleOffer(offerData) {
    this._startConnectTimeout()
    const generation = this.generation
    try {
      if (this.mediaReady) await this.mediaReady
      if (this.destroyed || generation !== this.generation || !this.peerConnection) return
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offerData))
      if (this.destroyed || generation !== this.generation) return
      await this._flushIncomingIce()
      if (this.destroyed || generation !== this.generation || !this.peerConnection) return
      const answer = await this.peerConnection.createAnswer()
      if (this.destroyed || generation !== this.generation) return
      await this.peerConnection.setLocalDescription(answer)
      if (this.destroyed || generation !== this.generation) return
      await this._sendSignal('video_answer', { sdp: answer.sdp, type: answer.type })
      if (this.destroyed || generation !== this.generation) return
      this._flushOutgoingIce()
    } catch (err) {
      console.error('Failed to handle offer:', err)
      if (this.destroyed || generation !== this.generation) return
      this.endCall()
      if (this.onError) this.onError('Could not process video offer.')
    }
  }

  async _handleAnswer(answerData) {
    const generation = this.generation
    try {
      if (this.peerConnection) {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answerData))
        if (!this.destroyed && generation === this.generation) await this._flushIncomingIce()
      }
    } catch (err) {
      console.error('Failed to handle answer:', err)
      if (this.onError) this.onError('Could not complete video handshake.')
    }
  }

  async _handleIceCandidate(candidateData) {
    try {
      if (this.peerConnection && candidateData && this.peerConnection.remoteDescription) {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidateData))
      } else if (candidateData && this.pendingIce.length < 200) {
        this.pendingIce.push(candidateData)
      }
    } catch (err) {
      console.warn('ICE candidate error:', err)
    }
  }

  async _flushIncomingIce() {
    const candidates = this.pendingIce.splice(0)
    for (const candidate of candidates) await this._handleIceCandidate(candidate)
  }

  _flushOutgoingIce() {
    this.canSendIce = true
    for (const candidate of this.pendingOutgoingIce.splice(0)) {
      void this._sendSignal('video_ice', candidate).catch((err) => console.warn('ICE signaling failed:', err.message))
    }
  }

  async _acquireLocalMedia(generation = this.generation) {
    if (this.localStream) return this.localStream

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Your browser does not support WebRTC media devices.')
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 } },
      audio: true,
    })
    if (this.destroyed || generation !== this.generation) {
      stream.getTracks().forEach((track) => track.stop())
      return null
    }
    this.localStream = stream
    return stream
  }

  _createPeerConnection() {
    if (this.peerConnection) return

    const config = {
      iceServers: getIceServers(),
    }

    this.peerConnection = new RTCPeerConnection(config)
    const connection = this.peerConnection

    // Send local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection.addTrack(track, this.localStream)
      })
    }

    // Handle remote tracks
    this.peerConnection.ontrack = (event) => {
      if (this.destroyed || this.peerConnection !== connection) return
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0]
        this._clearConnectTimeout()
        this._setCallState('connected')
        if (this.onRemoteStream) {
          this.onRemoteStream(this.remoteStream)
        }
      }
    }

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (this.destroyed || this.peerConnection !== connection) return
      if (event.candidate && this.sessionId) {
        const candidate = event.candidate.toJSON()
        if (this.canSendIce) {
          void this._sendSignal('video_ice', candidate).catch((err) => console.warn('ICE signaling failed:', err.message))
        } else if (this.pendingOutgoingIce.length < 200) {
          this.pendingOutgoingIce.push(candidate)
        }
      }
    }

    // Connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      if (this.destroyed || this.peerConnection !== connection) return
      const state = connection.connectionState
      if (state === 'connected') {
        this._clearConnectTimeout()
        this._setCallState('connected')
      } else if (state === 'disconnected' || state === 'failed') {
        this._clearConnectTimeout()
        this.endCall()
        if (state === 'failed' && this.onError) {
          this.onError('Direct video connection failed (NAT/firewall). Text chat remains active.')
        }
      }
    }

    // ICE connection state changes
    this.peerConnection.oniceconnectionstatechange = () => {
      if (this.destroyed || this.peerConnection !== connection) return
      const iceState = connection.iceConnectionState
      if (iceState === 'connected' || iceState === 'completed') {
        this._clearConnectTimeout()
        this._setCallState('connected')
      } else if (iceState === 'failed') {
        this._clearConnectTimeout()
        this.endCall()
        if (this.onError) {
          this.onError('Direct video connection failed (NAT/firewall). Text chat remains active.')
        }
      }
    }
  }

  toggleCamera(enable) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((t) => {
        t.enabled = enable
      })
    }
  }

  toggleMic(enable) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((t) => {
        t.enabled = enable
      })
    }
  }

  cleanupMedia() {
    this.generation += 1
    this._clearConnectTimeout()
    this.pendingIce = []
    this.pendingOutgoingIce = []
    this.canSendIce = false
    this.mediaReady = null
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop())
      this.localStream = null
    }
    if (this.peerConnection) {
      this.peerConnection.close()
      this.peerConnection = null
    }
    this.remoteStream = null
  }

  destroy() {
    if (this.destroyed) return
    clearInterval(this.pollTimer)
    if (this.sessionId) {
      void this._sendSignal('video_end').catch(() => {})
    }
    this.destroyed = true
    this.cleanupMedia()
    this.sessionId = null
  }
}

// ============================================================
// mockData.js — Realistic college-themed mock data for CampusMate
// ============================================================

// ─── USER ───────────────────────────────────────────────────
export const MOCK_USER = {
  id: 'user-1',
  name: 'Arjun Mehta',
  college: 'Delhi Technological University',
  department: 'Computer Science Engineering',
  semester: 5,
  email: 'arjun.mehta@dtu.ac.in',
  avatarInitials: 'AM',
};

// ─── TASKS ──────────────────────────────────────────────────
// 8 college-themed tasks with varying priorities and statuses
export const MOCK_TASKS = [
  {
    id: 'task-1',
    title: 'Submit Data Structures Assignment',
    subject: 'Data Structures & Algorithms',
    description:
      'Implement AVL tree with insertion, deletion, and balancing. Submit on the college portal.',
    priority: 'high',
    status: 'pending',
    dueDate: '2026-11-12T23:59:00.000Z',
    createdAt: '2026-11-01T10:00:00.000Z',
  },
  {
    id: 'task-2',
    title: 'Physics Lab Report',
    subject: 'Applied Physics',
    description:
      'Write a detailed lab report on the Young\'s Double Slit Experiment with observations and calculations.',
    priority: 'medium',
    status: 'completed',
    dueDate: '2026-11-08T18:00:00.000Z',
    createdAt: '2026-11-02T09:00:00.000Z',
  },
  {
    id: 'task-3',
    title: 'DBMS Quiz Prep',
    subject: 'Database Management Systems',
    description:
      'Revise normalization (1NF–BCNF), ER diagrams, SQL joins, and transaction management for the upcoming quiz.',
    priority: 'high',
    status: 'pending',
    dueDate: '2026-11-10T09:00:00.000Z',
    createdAt: '2026-11-03T11:30:00.000Z',
  },
  {
    id: 'task-4',
    title: 'Complete OOP Mini Project',
    subject: 'Object Oriented Programming',
    description:
      'Build a Library Management System in Java using OOP principles: inheritance, polymorphism, encapsulation.',
    priority: 'high',
    status: 'pending',
    dueDate: '2026-11-20T23:59:00.000Z',
    createdAt: '2026-11-01T14:00:00.000Z',
  },
  {
    id: 'task-5',
    title: 'Linear Algebra Problem Set',
    subject: 'Mathematics III',
    description:
      'Solve exercises on eigenvalues, eigenvectors, and matrix diagonalization from the textbook (Chapter 7).',
    priority: 'medium',
    status: 'completed',
    dueDate: '2026-11-06T17:00:00.000Z',
    createdAt: '2026-11-02T16:00:00.000Z',
  },
  {
    id: 'task-6',
    title: 'Read Computer Networks Ch. 8',
    subject: 'Computer Networks',
    description:
      'Read and take notes on Chapter 8 — Application Layer: HTTP, DNS, SMTP, and P2P applications.',
    priority: 'low',
    status: 'pending',
    dueDate: '2026-11-14T23:00:00.000Z',
    createdAt: '2026-11-04T08:00:00.000Z',
  },
  {
    id: 'task-7',
    title: 'Machine Learning Project Proposal',
    subject: 'Machine Learning',
    description:
      'Draft a 2-page project proposal for predicting student performance using regression models. Include dataset details.',
    priority: 'medium',
    status: 'pending',
    dueDate: '2026-11-15T23:59:00.000Z',
    createdAt: '2026-11-05T10:00:00.000Z',
  },
  {
    id: 'task-8',
    title: 'Prepare Seminar Presentation',
    subject: 'Professional Communication',
    description:
      'Create a 15-slide presentation on "Ethical Implications of Artificial Intelligence" for the department seminar.',
    priority: 'low',
    status: 'completed',
    dueDate: '2026-11-09T10:00:00.000Z',
    createdAt: '2026-11-01T12:00:00.000Z',
  },
];

// ─── EVENTS ─────────────────────────────────────────────────
// 7 college events across different categories with high-res photography
export const MOCK_EVENTS = [
  {
    id: 'event-1',
    title: 'TechFusion Hackathon 2026',
    description:
      '36-hour hackathon open to all CSE, IT, and ECE students. Build innovative solutions across tracks: HealthTech, EdTech, FinTech, and Smart Cities. Prizes worth ₹1,50,000.',
    category: 'hackathon',
    date: '2026-11-22T09:00:00.000Z',
    location: 'Innovation Hub, Block A, DTU',
    organizer: 'DTU ACM Student Chapter',
    image: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=900&q=80',
    registrationUrl: 'https://techfusion.dtu.ac.in',
    isRegistered: true,
    attendees: 312,
  },
  {
    id: 'event-2',
    title: 'Machine Learning Workshop Series',
    description:
      'Three-day hands-on workshop covering ML fundamentals, Scikit-learn, TensorFlow, and model deployment. Certificates provided to all participants.',
    category: 'workshop',
    date: '2026-11-18T10:00:00.000Z',
    location: 'Computer Lab 3, CSE Block',
    organizer: 'AI/ML Club DTU',
    image: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=900&q=80',
    registrationUrl: 'https://mlclub.dtu.ac.in/workshops',
    isRegistered: false,
    attendees: 78,
  },
  {
    id: 'event-3',
    title: 'Annual Cultural Festival — AURORA',
    description:
      'DTU\'s flagship cultural festival featuring music, dance, drama, standup comedy, and art installations. 3 days of non-stop entertainment with celebrity performances.',
    category: 'cultural',
    date: '2026-12-05T16:00:00.000Z',
    location: 'Open Air Theatre, DTU Main Campus',
    organizer: 'Student Affairs Committee',
    image: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=900&q=80',
    registrationUrl: 'https://aurora.dtu.ac.in',
    isRegistered: true,
    attendees: 2800,
  },
  {
    id: 'event-4',
    title: 'Google Industry Expert Talk',
    description:
      'Guest lecture by a Senior Software Engineer from Google on "Cracking FAANG Interviews" — DSA, System Design, and Behavioral rounds. Q&A session included.',
    category: 'seminar',
    date: '2026-11-14T14:00:00.000Z',
    location: 'Seminar Hall, Admin Block',
    organizer: 'Training & Placement Cell, DTU',
    image: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=900&q=80',
    registrationUrl: 'https://tnp.dtu.ac.in/events',
    isRegistered: false,
    attendees: 450,
  },
  {
    id: 'event-5',
    title: 'Inter-College Cricket Championship',
    description:
      'Annual inter-college T20 cricket tournament with 12 participating colleges. DTU Blue Thunder is defending champions. Register as a team of 15.',
    category: 'sports',
    date: '2026-11-25T08:00:00.000Z',
    location: 'DTU Sports Ground',
    organizer: 'Sports Council DTU',
    image: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=900&q=80',
    registrationUrl: 'https://sports.dtu.ac.in/cricket',
    isRegistered: false,
    attendees: 180,
  },
  {
    id: 'event-6',
    title: 'Photography Club Exhibition',
    description:
      'Annual photo exhibition "Frames of Life" showcasing the best student photography. Themes: Urban Life, Nature & Wildlife, Architecture, and Emotions. Voting open for People\'s Choice.',
    category: 'cultural',
    date: '2026-11-16T11:00:00.000Z',
    location: 'Art Gallery, Student Activity Centre',
    organizer: 'DTU Photography Club',
    image: 'https://images.unsplash.com/photo-1452587925148-ce544e77e70d?auto=format&fit=crop&w=900&q=80',
    registrationUrl: 'https://photoclub.dtu.ac.in',
    isRegistered: true,
    attendees: 95,
  },
  {
    id: 'event-7',
    title: 'Full-Stack Web Dev Bootcamp',
    description:
      '5-day intensive bootcamp covering HTML/CSS, JavaScript, React, Node.js, and MongoDB. Build and deploy two real projects. Limited seats — first come, first served.',
    category: 'workshop',
    date: '2026-12-01T09:00:00.000Z',
    location: 'Computer Lab 1, CSE Block',
    organizer: 'WebDev Society DTU',
    image: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=900&q=80',
    registrationUrl: 'https://webdev.dtu.ac.in/bootcamp',
    isRegistered: false,
    attendees: 55,
  },
];

export const ITEM_CATEGORY_IMAGES = {
  Electronics: `${import.meta.env.BASE_URL}landing/phone.jpg`,
  Accessories: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=600&q=80',
  Documents: 'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=600&q=80',
  Books: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80',
  Other: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=600&q=80',
};

// ─── LOST & FOUND ───────────────────────────────────────────
// 7 lost/found items on campus with authentic photography
export const MOCK_LOST_FOUND = [
  {
    id: 'lf-1',
    type: 'lost',
    category: 'Electronics',
    locationTag: 'Library',
    itemName: 'OnePlus Nord (Black)',
    description:
      'Black OnePlus Nord CE 3 with a cracked screen protector and a navy blue silicone case. Last seen near the library vending machines.',
    location: 'Central Library, Ground Floor',
    dateOccurred: '2026-11-05T13:30:00.000Z',
    imageUrl: `${import.meta.env.BASE_URL}landing/phone.jpg`,
    contactInfo: '9876543210',
    contactName: 'Rahul Verma',
    isResolved: false,
    userId: 'user-1',
    createdAt: '2026-11-05T15:00:00.000Z',
  },
  {
    id: 'lf-2',
    type: 'found',
    category: 'Accessories',
    locationTag: 'Canteen',
    itemName: 'Blue Tupperware Water Bottle',
    description:
      'Blue Tupperware bottle (1 litre) with a white flip cap. Has a small DTU sticker on the side. Found near the canteen tables.',
    location: 'DTU Main Canteen',
    dateOccurred: '2026-11-06T12:15:00.000Z',
    imageUrl: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=600&q=80',
    contactInfo: 'sneha.k@dtu.ac.in',
    contactName: 'Sneha Kapoor',
    isResolved: false,
    userId: 'user-2',
    createdAt: '2026-11-06T12:30:00.000Z',
  },
  {
    id: 'lf-3',
    type: 'lost',
    category: 'Electronics',
    locationTag: 'Labs',
    itemName: 'JBL TWS Earbuds (White)',
    description:
      'JBL Tune 230 NC True Wireless earbuds in a white charging case. Left earbud has a small scratch. Missing since Monday morning.',
    location: 'CSE Lab Corridor',
    dateOccurred: '2026-11-03T09:00:00.000Z',
    imageUrl: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=600&q=80',
    contactInfo: '8765432109',
    contactName: 'Karan Singh',
    isResolved: true,
    userId: 'user-3',
    createdAt: '2026-11-03T11:00:00.000Z',
  },
  {
    id: 'lf-4',
    type: 'found',
    category: 'Documents',
    locationTag: 'Auditorium',
    itemName: 'Student ID Card — Priya Sharma',
    description:
      'DTU student ID card for Priya Sharma, Roll No. 2K22/CO/178, CSE 4th year. Found near the auditorium entrance desk.',
    location: 'Auditorium Entrance, DTU',
    dateOccurred: '2026-11-07T08:45:00.000Z',
    imageUrl: 'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=600&q=80',
    contactInfo: 'security@dtu.ac.in',
    contactName: 'Security Cabin',
    isResolved: false,
    userId: 'user-4',
    createdAt: '2026-11-07T09:00:00.000Z',
  },
  {
    id: 'lf-5',
    type: 'lost',
    category: 'Books',
    locationTag: 'Labs',
    itemName: 'Physics Notebook — Sem 5',
    description:
      'Spiral-bound notebook with "Applied Physics Sem 5" written on the cover. Has handwritten notes from Unit 1–4 and multiple Post-it notes. Very important before exams!',
    location: 'Physics Lab, Room 204',
    dateOccurred: '2026-11-04T16:00:00.000Z',
    imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80',
    contactInfo: 'arjun.mehta@dtu.ac.in',
    contactName: 'Arjun Mehta',
    isResolved: false,
    userId: 'user-1',
    createdAt: '2026-11-04T17:30:00.000Z',
  },
  {
    id: 'lf-6',
    type: 'found',
    category: 'Accessories',
    locationTag: 'Hostel',
    itemName: 'Black Folding Umbrella',
    description:
      'Black automatic folding umbrella with a wooden handle. Brand: Amazon Basics. Found on the bench outside the hostel common room.',
    location: 'Aryabhatta Hostel Common Room',
    dateOccurred: '2026-11-02T18:00:00.000Z',
    imageUrl: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=600&q=80',
    contactInfo: '7654321098',
    contactName: 'Meera Joshi',
    isResolved: true,
    userId: 'user-5',
    createdAt: '2026-11-02T19:00:00.000Z',
  },
  {
    id: 'lf-7',
    type: 'lost',
    category: 'Accessories',
    locationTag: 'Hostel',
    itemName: 'Nike Air Max Running Shoes (Size 9)',
    description:
      'Nike Air Max 270 in white/grey colorway, size UK 9. Lost in the hostel gym locker room. Has my name written inside with a marker: "Arjun".',
    location: 'Hostel Gym Locker Room',
    dateOccurred: '2026-11-01T07:30:00.000Z',
    imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80',
    contactInfo: '9876543210',
    contactName: 'Arjun Mehta',
    isResolved: false,
    userId: 'user-1',
    createdAt: '2026-11-01T10:00:00.000Z',
  },
];

// ─── RESOURCES ──────────────────────────────────────────────
// 8 study resources shared by students
export const MOCK_RESOURCES = [
  {
    id: 'res-1',
    title: 'DBMS Complete Notes PDF',
    description:
      'Comprehensive handwritten + typed notes covering all DBMS units: ER model, relational algebra, normalization, SQL, transactions, and concurrency control. Exam-ready.',
    subject: 'Database Management Systems',
    semester: 5,
    resourceType: 'pdf',
    url: 'https://drive.google.com/drive/folders/dbms-notes-sem5',
    tags: ['DBMS', 'SQL', 'normalization', 'exam prep'],
    createdAt: '2026-10-20T10:00:00.000Z',
  },
  {
    id: 'res-2',
    title: 'Andrew Ng ML Course (Coursera)',
    description:
      'The gold standard Machine Learning course by Andrew Ng. Covers supervised, unsupervised learning, neural networks, and ML project best practices. Free to audit.',
    subject: 'Machine Learning',
    semester: 5,
    resourceType: 'link',
    url: 'https://www.coursera.org/learn/machine-learning',
    tags: ['ML', 'AI', 'Andrew Ng', 'beginner-friendly'],
    createdAt: '2026-10-15T09:00:00.000Z',
  },
  {
    id: 'res-3',
    title: 'Data Structures Cheat Sheet',
    description:
      'One-page cheat sheet covering time/space complexities of all major data structures: arrays, linked lists, stacks, queues, trees, heaps, graphs, and hash tables.',
    subject: 'Data Structures & Algorithms',
    semester: 3,
    resourceType: 'pdf',
    url: 'https://drive.google.com/drive/folders/ds-cheatsheet',
    tags: ['DSA', 'cheat sheet', 'complexity', 'quick reference'],
    createdAt: '2026-10-10T14:00:00.000Z',
  },
  {
    id: 'res-4',
    title: 'OS Concepts Slides',
    description:
      'Official lecture slides from the Operating Systems course covering processes, threads, CPU scheduling, deadlocks, memory management, file systems, and I/O.',
    subject: 'Operating Systems',
    semester: 4,
    resourceType: 'pdf',
    url: 'https://drive.google.com/drive/folders/os-slides-sem4',
    tags: ['OS', 'processes', 'scheduling', 'memory management'],
    createdAt: '2026-10-05T08:00:00.000Z',
  },
  {
    id: 'res-5',
    title: 'Python for Data Science Tutorial',
    description:
      'YouTube playlist covering Python fundamentals, NumPy, Pandas, Matplotlib, and Seaborn for data analysis. Perfect for ML project preparation.',
    subject: 'Machine Learning',
    semester: 5,
    resourceType: 'video',
    url: 'https://www.youtube.com/playlist?list=PLeo1K3hjS3us_ELKYSj_Fth2tIEkdKXBV',
    tags: ['Python', 'NumPy', 'Pandas', 'data science'],
    createdAt: '2026-10-18T11:00:00.000Z',
  },
  {
    id: 'res-6',
    title: 'Computer Networks Handbook',
    description:
      'Forouzan\'s "Data Communications and Networking" textbook PDF — the standard reference for the CN course covering all 5 layers of the TCP/IP model.',
    subject: 'Computer Networks',
    semester: 5,
    resourceType: 'pdf',
    url: 'https://drive.google.com/drive/folders/cn-forouzan',
    tags: ['networking', 'TCP/IP', 'HTTP', 'textbook'],
    createdAt: '2026-09-25T09:00:00.000Z',
  },
  {
    id: 'res-7',
    title: 'Discrete Mathematics Formula Sheet',
    description:
      'Formula sheet for Discrete Mathematics covering set theory, logic, relations, graph theory, trees, combinatorics, and recurrence relations. 4-page quick reference.',
    subject: 'Discrete Mathematics',
    semester: 2,
    resourceType: 'note',
    url: 'https://drive.google.com/drive/folders/dm-formula-sheet',
    tags: ['discrete maths', 'formulas', 'graph theory', 'combinatorics'],
    createdAt: '2026-09-10T14:00:00.000Z',
  },
  {
    id: 'res-8',
    title: 'React.js Official Documentation',
    description:
      'The official React documentation — the best resource for learning React. Covers hooks, components, state management, routing, and advanced patterns with interactive examples.',
    subject: 'Web Technologies',
    semester: 5,
    resourceType: 'link',
    url: 'https://react.dev',
    tags: ['React', 'JavaScript', 'frontend', 'web dev'],
    createdAt: '2026-10-22T16:00:00.000Z',
  },
];

// ─── TODAY'S SCHEDULE ───────────────────────────────────────
export const MOCK_TODAY_SCHEDULE = [
  { id: 'sch-1', time: '09:00 AM', title: 'Data Structures & Algorithms', type: 'Class', location: 'Room 204, Academic Block' },
  { id: 'sch-2', time: '11:00 AM', title: 'DBMS Practical Lab', type: 'Lab', location: 'Computer Lab 2, CSE Block' },
  { id: 'sch-3', time: '02:00 PM', title: 'DBMS Quiz — Unit 1 & 2', type: 'Exam', location: 'Seminar Hall B' },
  { id: 'sch-4', time: '04:30 PM', title: 'ACM Coding Meetup', type: 'Activity', location: 'Innovation Hub, Block A' },
];

/**
 * Seed analytics data for testing
 * Creates 100+ visitors with realistic check-in patterns across 30 days
 */

import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5434,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'ii_vms',
});

const names = [
  'John Smith', 'Sarah Johnson', 'Mike Davis', 'Emily Wilson', 'Robert Brown',
  'Lisa Anderson', 'James Taylor', 'Mary Martinez', 'William Garcia', 'Jennifer Lopez',
  'David Rodriguez', 'Patricia Lee', 'Richard White', 'Linda Harris', 'Joseph Clark',
  'Barbara Lewis', 'Thomas Walker', 'Susan Hall', 'Charles Allen', 'Jessica Young',
  'Christopher Hernandez', 'Dorothy King', 'Daniel Wright', 'Margaret Lopez', 'Matthew Hill',
  'Sandra Scott', 'Anthony Green', 'Cynthia Adams', 'Mark Nelson', 'Kathleen Baker',
  'Donald Carter', 'Shirley Roberts', 'Steven Phillips', 'Nora Campbell', 'Paul Parker',
  'Diane Evans', 'Andrew Edwards', 'Joanne Collins', 'Joshua Reeves', 'Evelyn Morris',
  'Kenneth Rogers', 'Glenda Rogers', 'Kevin Peterson', 'Ivy Peterson', 'Brian Bell',
  'Gloria Bell',
];

const hosts = [
  'Alice Chen', 'Bob Wilson', 'Carol Davis', 'David Brown', 'Emma Johnson'
];

const purposes = [
  'Business Meeting', 'Client Visit', 'Job Interview', 'Delivery', 'Maintenance',
  'Consultation', 'Partnership Discussion', 'Training', 'Site Inspection', 'Guest Lecture'
];

// Generate random date in past 30 days
function randomDate() {
  const now = new Date();
  const daysAgo = Math.floor(Math.random() * 30);
  const hours = Math.floor(Math.random() * 24);
  const minutes = Math.floor(Math.random() * 60);
  
  const date = new Date(now);
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

// Random element from array
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Generate email
function generateEmail(name) {
  return name.toLowerCase().replace(/\s+/g, '.') + '@example.com';
}

// Generate phone
function generatePhone() {
  return '+1' + Math.floor(Math.random() * 9000000000 + 1000000000);
}

// Generate unique QR token
function generateQRToken() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

async function seedData() {
  try {
    console.log('Starting analytics data seeding...');
    
    const client = await pool.connect();
    
    // Start transaction
    await client.query('BEGIN');
    
    // Clear existing visitors (optional - comment out to keep old data)
    // await client.query('DELETE FROM visitors');
    
    const insertedIds = [];
    
    // Create 100+ visitors with realistic patterns
    for (let i = 0; i < 120; i++) {
      const name = pick(names);
      const email = generateEmail(name) + i;
      const phone = generatePhone();
      const purpose = pick(purposes);
      const qrToken = generateQRToken();
      const createdAt = randomDate();
      
      // Some visitors have check-ins, some don't
      const hasCheckIn = Math.random() > 0.2; // 80% check-in rate
      const checkedInAt = hasCheckIn ? new Date(createdAt.getTime() + Math.random() * 3600000) : null;
      
      // Some have photos (for biometric data)
      const photoUrl = Math.random() > 0.3 ? `https://via.placeholder.com/100?text=${name}` : null;
      
      const result = await client.query(
        `INSERT INTO visitors (name, email, phone, purpose, photo_url, qr_token, created_at, checked_in_at, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [name, email, phone, purpose, photoUrl, qrToken, createdAt, checkedInAt, hasCheckIn ? 'checked_in' : 'registered']
      );
      
      const visitorId = result.rows[0].id;
      insertedIds.push(visitorId);
      
      // Add some biometric enrollment events (50% of visitors)
      if (Math.random() > 0.5 && photoUrl) {
        await client.query(
          `INSERT INTO analytics_events (name, payload, created_at)
           VALUES ($1, $2, $3)`,
          [
            'visitor_face_captured',
            JSON.stringify({ visitor_id: visitorId, photo_url: photoUrl }),
            createdAt
          ]
        );
      }
      
      // Add some verification attempts (30% with failures)
      if (Math.random() > 0.7) {
        const verificationResult = Math.random() > 0.3 ? 'success' : 'failed';
        await client.query(
          `INSERT INTO analytics_events (name, payload, created_at)
           VALUES ($1, $2, $3)`,
          [
            verificationResult === 'success' ? 'visitor_face_verified' : 'visitor_face_verify_failed',
            JSON.stringify({ visitor_id: visitorId, confidence: Math.random() * 100 }),
            new Date(createdAt.getTime() + Math.random() * 1800000)
          ]
        );
      }
      
      if ((i + 1) % 10 === 0) {
        console.log(`Created ${i + 1} visitors...`);
      }
    }
    
    // Add some repeat visitors (create multiple visits for same person)
    const repeatVisitorCount = 20;
    for (let i = 0; i < repeatVisitorCount; i++) {
      const visitorId = insertedIds[Math.floor(Math.random() * insertedIds.length)];
      const baseDate = new Date();
      baseDate.setDate(baseDate.getDate() - Math.floor(Math.random() * 25));
      
      for (let j = 0; j < Math.floor(Math.random() * 3) + 1; j++) {
        const visitDate = new Date(baseDate);
        visitDate.setDate(visitDate.getDate() + j * 5);
        visitDate.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60), 0, 0);
        
        const hasCheckIn = Math.random() > 0.1;
        const checkedInAt = hasCheckIn ? new Date(visitDate.getTime() + Math.random() * 3600000) : null;
        
        await client.query(
          `INSERT INTO analytics_events (name, payload, created_at)
           VALUES ($1, $2, $3)`,
          [
            'visitor_check_in',
            JSON.stringify({ visitor_id: visitorId }),
            visitDate
          ]
        );
      }
    }
    
    // Commit transaction
    await client.query('COMMIT');
    await client.release();
    
    console.log(`✓ Successfully seeded analytics data!`);
    console.log(`  - Created 120 visitors`);
    console.log(`  - Added 20+ repeat visitor patterns`);
    console.log(`  - Generated biometric and verification events`);
    
    await pool.end();
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
}

seedData();

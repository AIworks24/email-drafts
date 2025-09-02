// Create this file as: src/test-db-connection.ts
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

async function testConnection() {
  console.log('🔍 Testing database connection...');
  console.log('Connection string:', process.env.DATABASE_URL?.replace(/:[^:@]*@/, ':***@'));
  
  const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
  });

  try {
    console.log('⏳ Attempting to connect...');
    
    // Simple connection test
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Database connection successful!', result);
    
    // Test if tables exist
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    console.log('📋 Existing tables:', tables);
    
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error code:', (error as any).code);
    }
  } finally {
    await prisma.$disconnect();
    console.log('🔌 Disconnected from database');
  }
}

testConnection();
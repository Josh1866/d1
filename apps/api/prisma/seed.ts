import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();
async function main() {
 const email=process.env.ADMIN_EMAIL; const password=process.env.ADMIN_PASSWORD;
 if (!email || !password || password.length < 12) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (12+ chars) in .env before seeding');
 await prisma.user.upsert({where:{email:email.toLowerCase()},update:{role:'ADMIN'},create:{email:email.toLowerCase(),name:'D1 Administrator',passwordHash:await bcrypt.hash(password,12),role:'ADMIN'}});
 console.log('Admin created/updated:',email);
}
main().finally(()=>prisma.$disconnect());

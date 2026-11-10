import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './module';
import { mkdir } from 'fs/promises';
import path from 'path';
async function bootstrap(){
 if(!process.env.JWT_SECRET || process.env.JWT_SECRET.length<32) throw new Error('JWT_SECRET must contain at least 32 characters');
 await mkdir(path.resolve(process.cwd(),'uploads'),{recursive:true});
 const app=await NestFactory.create(AppModule,{rawBody:true});
 app.enableCors({origin:(process.env.WEB_ORIGIN||'http://localhost:3000').split(','),methods:['GET','POST','PATCH','DELETE'],allowedHeaders:['Authorization','Content-Type']});
 app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));
 await app.listen(Number(process.env.PORT||4000),'0.0.0.0');
 console.log('D1 API ready');
}
bootstrap();

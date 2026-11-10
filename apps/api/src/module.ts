import { Module } from '@nestjs/common';
import { AppController } from './routes';
import { Database } from './services';
@Module({controllers:[AppController],providers:[Database]}) export class AppModule {}

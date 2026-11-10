import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Headers, HttpCode, NotFoundException, Param, Patch, Post, Query, Req, Res, UnauthorizedException, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsEmail, IsIn, IsOptional, IsString, Length, MaxLength, MinLength } from 'class-validator';
import { Database } from './services';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { mkdir, open, stat } from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';
import { diskStorage } from 'multer';
import type { Request, Response } from 'express';
class RegisterDto { @IsEmail() email!:string; @IsString() @MinLength(12) password!:string; @IsString() @Length(2,80) name!:string; @IsOptional() @IsString() @Length(2,80) stageName?:string; }
class LoginDto { @IsEmail() email!:string; @IsString() password!:string; }
class PlaylistDto { @IsString() @Length(1,80) name!:string; }
class TrackDto { @IsString() @Length(1,120) title!:string; @IsOptional() @IsString() @MaxLength(60) genre?:string; }
class StatusDto { @IsIn(['APPROVED','REJECTED']) status!:'APPROVED'|'REJECTED'; }
const uploads=path.resolve(process.cwd(),'uploads');
const audioTypes=['audio/mpeg','audio/mp4','audio/x-m4a','audio/wav','audio/x-wav','audio/flac','audio/ogg'];
const extByMime:Record<string,string>={'audio/mpeg':'.mp3','audio/mp4':'.m4a','audio/x-m4a':'.m4a','audio/wav':'.wav','audio/x-wav':'.wav','audio/flac':'.flac','audio/ogg':'.ogg'};
const storage=diskStorage({destination:(_req,_file,cb)=>cb(null,uploads),filename:(_req,file,cb)=>cb(null,randomUUID()+(extByMime[file.mimetype]||'.bin'))});
@Controller('v1') export class AppController {
 constructor(private db:Database){}
 private auth(req:Request,roles?:string[]){
  const header=req.headers.authorization||'';
  if(!header.startsWith('Bearer '))throw new UnauthorizedException('Sign in required');
  let user:any;try{user=jwt.verify(header.slice(7),process.env.JWT_SECRET!,{algorithms:['HS256']});}catch{throw new UnauthorizedException('Session expired');}
  if(!user || typeof user!=='object'||!user.sub||!user.role)throw new UnauthorizedException();
  if(roles&&!roles.includes(user.role))throw new ForbiddenException();return user as {sub:string;role:string};
 }
 private async current(req:Request,roles?:string[]){const token=this.auth(req);const user=await this.db.user.findUnique({where:{id:token.sub},include:{artist:true}});if(!user)throw new UnauthorizedException();if(roles&&!roles.includes(user.role))throw new ForbiddenException();return user;}
 private session(user:any){return {token:jwt.sign({sub:user.id,role:user.role},process.env.JWT_SECRET!,{algorithm:'HS256',expiresIn:'7d'}),user:{id:user.id,email:user.email,name:user.name,role:user.role,artist:user.artist}};}
 @Get('health') health(){return {ok:true,service:'D1 API'};}
 @Post('auth/register') async register(@Body() dto:RegisterDto){const email=dto.email.trim().toLowerCase();if(await this.db.user.findUnique({where:{email}}))throw new BadRequestException('Email already registered');const user=await this.db.user.create({data:{email,name:dto.name.trim(),passwordHash:await bcrypt.hash(dto.password,12),role:dto.stageName?'ARTIST':'LISTENER',...(dto.stageName?{artist:{create:{stageName:dto.stageName.trim()}}}:{})},include:{artist:true}});return this.session(user);}
 @Post('auth/login') @HttpCode(200) async login(@Body() dto:LoginDto){const user=await this.db.user.findUnique({where:{email:dto.email.trim().toLowerCase()},include:{artist:true}});if(!user||!(await bcrypt.compare(dto.password,user.passwordHash)))throw new UnauthorizedException('Invalid credentials');return this.session(user);}
 @Get('auth/me') async me(@Req() req:Request){const u=await this.current(req);return {id:u.id,email:u.email,name:u.name,role:u.role,artist:u.artist};}
 @Get('tracks') async tracks(@Query('q') q?:string){return this.db.track.findMany({where:{status:'APPROVED',...(q?{OR:[{title:{contains:q,mode:'insensitive'}},{artist:{stageName:{contains:q,mode:'insensitive'}}}]}:{})},include:{artist:{select:{id:true,stageName:true}}},orderBy:{createdAt:'desc'},take:100});}
 @Get('artists') async artists(){return this.db.artist.findMany({select:{id:true,stageName:true,bio:true,_count:{select:{tracks:true}}},take:100});}
 @Get('artists/:id') async artist(@Param('id') id:string){const a=await this.db.artist.findUnique({where:{id},include:{tracks:{where:{status:'APPROVED'}}}});if(!a)throw new NotFoundException();return a;}
 @Get('artist/tracks') async myTracks(@Req() req:Request){const u=await this.current(req,['ARTIST','ADMIN']);if(!u.artist)return [];return this.db.track.findMany({where:{artistId:u.artist.id},orderBy:{createdAt:'desc'}});}
 @Post('artist/tracks') @UseInterceptors(FileInterceptor('audio',{storage,limits:{fileSize:25*1024*1024},fileFilter:(_req,file,cb)=>cb(null,audioTypes.includes(file.mimetype))})) async upload(@Req() req:Request,@UploadedFile() file:Express.Multer.File,@Body() body:TrackDto){const u=await this.current(req,['ARTIST']);if(!u.artist)throw new ForbiddenException();if(!file)throw new BadRequestException('Valid audio file required (max 25MB)');const handle=await open(file.path,'r');try{const buf=Buffer.alloc(12);await handle.read(buf,0,12,0);const valid=buf.subarray(0,3).toString()==='ID3'||buf.subarray(0,4).toString()==='RIFF'||buf.subarray(4,8).toString()==='ftyp'||buf.subarray(0,4).toString()==='fLaC'||buf.subarray(0,4).toString()==='OggS'||buf[0]===0xff;if(!valid)throw new BadRequestException('Audio signature not recognized');}finally{await handle.close();}return this.db.track.create({data:{title:body.title,genre:body.genre||'Other',audioPath:file.filename,mimeType:file.mimetype,originalName:file.originalname,artistId:u.artist.id}});}
 @Get('tracks/:id/stream') async stream(@Param('id') id:string,@Req() req:Request,@Res() res:Response){const track=await this.db.track.findUnique({where:{id}});if(!track||track.status!=='APPROVED')throw new NotFoundException();const file=path.join(uploads,path.basename(track.audioPath));const info=await stat(file).catch(()=>null);if(!info)throw new NotFoundException();const range=req.headers.range;res.setHeader('Content-Type',track.mimeType);res.setHeader('Accept-Ranges','bytes');res.setHeader('Cache-Control','private, max-age=0');if(range){const match=/^bytes=(\d*)-(\d*)$/.exec(range);if(!match){res.status(416).end();return;}const start=match[1]?Number(match[1]):0;const end=match[2]?Number(match[2]):info.size-1;if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||end>=info.size){res.status(416).setHeader('Content-Range',`bytes */${info.size}`).end();return;}res.status(206);res.setHeader('Content-Range',`bytes ${start}-${end}/${info.size}`);res.setHeader('Content-Length',end-start+1);createReadStream(file,{start,end}).pipe(res);}else{res.setHeader('Content-Length',info.size);createReadStream(file).pipe(res);}}
 @Get('playlists') async playlists(@Req() req:Request){const u=await this.current(req);return this.db.playlist.findMany({where:{userId:u.id},include:{tracks:{include:{track:{include:{artist:true}}}}},orderBy:{createdAt:'desc'}});}
 @Post('playlists') async createPlaylist(@Req() req:Request,@Body() dto:PlaylistDto){const u=await this.current(req);return this.db.playlist.create({data:{name:dto.name,userId:u.id}});}
 @Post('playlists/:id/tracks/:trackId') async addTrack(@Req() req:Request,@Param('id') id:string,@Param('trackId') trackId:string){const u=await this.current(req);const p=await this.db.playlist.findFirst({where:{id,userId:u.id}});if(!p)throw new NotFoundException();const t=await this.db.track.findFirst({where:{id:trackId,status:'APPROVED'}});if(!t)throw new NotFoundException();return this.db.playlistTrack.upsert({where:{playlistId_trackId:{playlistId:id,trackId}},update:{},create:{playlistId:id,trackId}});}
 @Delete('playlists/:id/tracks/:trackId') async removeTrack(@Req() req:Request,@Param('id') id:string,@Param('trackId') trackId:string){const u=await this.current(req);const p=await this.db.playlist.findFirst({where:{id,userId:u.id}});if(!p)throw new NotFoundException();await this.db.playlistTrack.deleteMany({where:{playlistId:id,trackId}});return {ok:true};}
 // Demo-only purchase and tip simulation: no card charges, no transfers, no payable balances.
 @Post('demo/transactions') async demoTransaction(@Req() req:Request,@Body() body:{kind:string;trackId:string;amountCents?:number}){
  const buyer=await this.current(req);
  if(!['TIP','PURCHASE'].includes(body.kind))throw new BadRequestException('Invalid transaction type');
  if(typeof body.trackId!=='string')throw new BadRequestException('Track required');
  const track=await this.db.track.findFirst({where:{id:body.trackId,status:'APPROVED'}});
  if(!track)throw new NotFoundException('Approved track not found');
  const amount=body.kind==='PURCHASE'?1500:body.amountCents;
  if(!Number.isSafeInteger(amount)||amount!<100||amount!>100000)throw new BadRequestException('Amount must be R1–R1000');
  if(track.artistId===buyer.artist?.id)throw new BadRequestException('Cannot support your own artist profile');
  return this.db.demoTransaction.create({data:{kind:body.kind as 'TIP'|'PURCHASE',amountCents:amount!,artistId:track.artistId,buyerId:buyer.id,trackId:track.id},select:{id:true,kind:true,amountCents:true,currency:true,createdAt:true}});
 }
 @Get('artist/demo-earnings') async demoEarnings(@Req() req:Request){
  const user=await this.current(req,['ARTIST']);if(!user.artist)throw new ForbiddenException();
  const transactions=await this.db.demoTransaction.findMany({where:{artistId:user.artist.id},include:{track:{select:{title:true}}},orderBy:{createdAt:'desc'},take:100});
  const totals=await this.db.demoTransaction.groupBy({by:['kind'],where:{artistId:user.artist.id},_sum:{amountCents:true},_count:{_all:true}});
  return {demoOnly:true,transactions,totals};
 }
 @Get('admin/demo-transactions') async adminDemoTransactions(@Req() req:Request){
  await this.current(req,['ADMIN']);return this.db.demoTransaction.findMany({include:{artist:{select:{stageName:true}},buyer:{select:{email:true}},track:{select:{title:true}}},orderBy:{createdAt:'desc'},take:100});
 }
 @Get('admin/overview') async overview(@Req() req:Request){await this.current(req,['ADMIN']);const [users,artists,tracks,pending]=await Promise.all([this.db.user.count(),this.db.artist.count(),this.db.track.count(),this.db.track.count({where:{status:'PENDING'}})]);return {users,artists,tracks,pending};}
 @Get('admin/tracks') async review(@Req() req:Request){await this.current(req,['ADMIN']);return this.db.track.findMany({include:{artist:{select:{stageName:true}}},orderBy:{createdAt:'desc'},take:200});}
 @Patch('admin/tracks/:id') async moderate(@Req() req:Request,@Param('id') id:string,@Body() dto:StatusDto){await this.current(req,['ADMIN']);return this.db.track.update({where:{id},data:{status:dto.status}});}
}

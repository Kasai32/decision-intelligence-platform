import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum } from 'class-validator';
import { Role } from '@prisma/client';

export class AddMemberDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: Role, default: Role.MEMBER })
  @IsEnum(Role)
  role: Role = Role.MEMBER;
}

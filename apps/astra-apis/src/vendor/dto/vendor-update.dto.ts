import {ApiPropertyOptional} from '@nestjs/swagger';
import {IsOptional, IsString, MaxLength} from 'class-validator';
import {VendorCreateResponseDto} from './vendor-create.dto';

export class VendorUpdateDto {
  @ApiPropertyOptional({description: 'Vendor display name', maxLength: 200})
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({description: 'Payment terms', maxLength: 100, nullable: true})
  @IsOptional()
  @IsString()
  @MaxLength(100)
  terms?: string | null;
}

export class VendorUpdateResponseDto extends VendorCreateResponseDto {}

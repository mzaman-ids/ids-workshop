import {ApiProperty, ApiPropertyOptional} from '@nestjs/swagger';
import {Type} from 'class-transformer';
import {
  ArrayMinSize,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {PoLineCreateDto} from './po-line-create.dto';

export class PoCreateDto {
  @ApiProperty({description: 'Vendor document ID (e.g. vendors/STAR-OFFICE)'})
  @IsNotEmpty()
  @IsString()
  vendorId!: string;

  @ApiProperty({type: [PoLineCreateDto], description: 'Order lines — at least one required'})
  @ArrayMinSize(1, {message: 'At least one line is required'})
  @ValidateNested({each: true})
  @Type(() => PoLineCreateDto)
  lines!: PoLineCreateDto[];

  @ApiPropertyOptional({description: 'Optional notes', maxLength: 500, nullable: true})
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

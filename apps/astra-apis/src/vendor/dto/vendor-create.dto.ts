import {ApiProperty, ApiPropertyOptional} from '@nestjs/swagger';
import {IsNotEmpty, IsOptional, IsString, MaxLength} from 'class-validator';

export class VendorCreateDto {
  @ApiProperty({description: 'Short unique vendor code', example: 'ACME-CORP', maxLength: 50})
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  code!: string;

  @ApiProperty({description: 'Vendor display name', example: 'Acme Corporation', maxLength: 200})
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({
    description: 'Payment terms, e.g. "Net 30"',
    maxLength: 100,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  terms?: string | null;
}

export class VendorCreateResponseDto {
  @ApiProperty({description: 'Vendor document ID'})
  id!: string;

  @ApiProperty({description: 'Short unique vendor code'})
  code!: string;

  @ApiProperty({description: 'Vendor display name'})
  name!: string;

  @ApiPropertyOptional({description: 'Payment terms', nullable: true})
  terms?: string | null;
}

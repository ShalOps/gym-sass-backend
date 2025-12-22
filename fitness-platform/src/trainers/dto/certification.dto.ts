import { IsString, IsNotEmpty, IsDateString, IsUrl, IsOptional } from 'class-validator';

export class CertificationDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  issuingOrganization: string;

  @IsDateString()
  issueDate: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsUrl()
  fileUrl: string; 
}
import { IsString, IsNumber, IsOptional, IsArray, IsBoolean, IsDate, IsDecimal, ValidateNested } from 'class-validator';
import { CertificationDto } from './certification.dto';
import { Type } from 'class-transformer';
import { SpecializationDto } from './specializaton.dto';

export class CreateTrainerDto {

    @IsOptional()
    @IsString()
    bio?: string;

    @IsOptional()
    @IsString()
    gender?: string;

    @IsOptional()
    @IsDate()
    dob?: Date;

    @IsOptional()
    @IsDecimal({ decimal_digits: '0,2' })
    hourlyRate: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SpecializationDto)
    specializations: SpecializationDto[];

    @IsOptional()
    @IsNumber()
    yearsOfExperience: number;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CertificationDto)
    certificationFiles: CertificationDto[];

    @IsOptional()
    profilePicture?: string


    @IsOptional()
    @IsBoolean()
    verified?: boolean;
}

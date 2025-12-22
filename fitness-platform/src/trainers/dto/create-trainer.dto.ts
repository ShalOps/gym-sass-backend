import { IsString, IsNumber, IsOptional, IsArray, IsBoolean, IsDate, IsDecimal } from 'class-validator';

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

    @IsOptional()
    specializations: object[];

    @IsOptional()
    @IsNumber()
    yearsOfExperience: number;

    @IsOptional()
    certificationFiles: object[];

    @IsOptional()
    profilePicture?: string


    @IsOptional()
    @IsBoolean()
    verified?: boolean;
}

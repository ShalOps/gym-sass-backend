import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { EmailService } from './email.service';
import { sendEmailDto } from './dto/email.dto';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Role } from '@prisma/client';
import { Roles } from 'src/auth/roles.decorator';

@Controller('email')
export class EmailController {
    constructor(private readonly emailService: EmailService){}

    @Post('send')
    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN)
    async sendMail(@Body() dto:sendEmailDto){
        await this.emailService.sendEmail(dto);
        return {message:'Email Sent Successfully'};
    }


}

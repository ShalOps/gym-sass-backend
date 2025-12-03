import { Controller, Post, Body, UseGuards, Get, Req, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { GoogleAuthGuard } from './guards/google-auth/google-auth.guard';
import type { Request } from 'express';

interface User {
  userId: number;
  role: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 409, description: 'Conflict, user already exists' })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login user' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful, returns JWT token',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  me(@Req() req: Request) {
    const userId = (req.user as User).userId;
    return this.auth.getProfile(userId);
  }


  @UseGuards(GoogleAuthGuard)
  @Get('google/login')
  @ApiOperation({ summary: 'Initiate Google OAuth login process' })
  @ApiResponse({ status: 302, description: 'Redirects the user to the Google consent screen.' })
  googleLogin() {
    
  }

  @UseGuards(GoogleAuthGuard)
  @Get('google/callback')
  @ApiOperation({ 
    summary: 'Handle callback from Google OAuth',
    description: 'Processes the Google response. Redirects to the frontend success page with a JWT token OR to a completion page if the user is new and needs to provide a phone number/profile details.'
  })
  @ApiResponse({ 
    status: 302, 
    description: 'Successful authentication. Redirects to frontend login success page with token (e.g., `/login/success?token=...`).',
    headers: {
      'Location': {
        schema: {
          type: 'string',
          example: 'http://localhost:5173/login/success?token=${token}',
        }
      }
    }
  })
  @ApiResponse({ 
    status: 302, 
    description: 'New user requiring phone/profile details. Redirects to frontend completion page (e.g., `/link-phone?googleData=...`).',
    headers: {
      'Location': {
        schema: {
          type: 'string',
          example: 'http://localhost:5173/link-phone?session=${sessionId}',
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Authentication failed (e.g., Google user rejects the request).' })
  async googleCallback(@Req() req, @Res() res) {
    const userOrPartial = req.user as any; 

    if (!userOrPartial.requiresPhone) {
      const token = await this.auth.generateJwt(userOrPartial);
      return res.redirect(`http://localhost:5173/login/success?token=${token}`);
    }
    
    const sessionId = this.auth.createTempSession(userOrPartial.googleData);
    return res.redirect(
      `http://localhost:5173/link-phone?session=${sessionId}`,
    );
  }

  @Post('google/link-phone')
  async linkGooglePhone(@Body() body: any, @Res() res) {

    const { 
      session,
      phoneNo, 
      gender, 
      goal, 
      location, 
      bio,
      role,         
      birthDate   
    } = body;


    const googleData = this.auth.getTempSession(session);
    if (!googleData) {
      return res.status(400).json({ message: 'Invalid or expired session' });
    }

    const user = await this.auth.registerOrLinkGoogleUser({ 
      phoneNo, gender, goal, googleData, location, bio, role, birthDate 
    });

    
    this.auth.clearTempSession(session);
    const token = await this.auth.generateJwt(user);
    return res.json({ token });

  }
}

import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { AuthService } from '../auth.service';
import type { ConfigType } from '@nestjs/config';
import googleOauthConfig from 'src/config/google-oauth.config';

const GOOGLE_CONFIG_KEY = googleOauthConfig.KEY;

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    @Inject(GOOGLE_CONFIG_KEY)
    private readonly googleConfig: ConfigType<typeof googleOauthConfig>,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: googleConfig.clientID,
      clientSecret: googleConfig.clientSecret,
      callbackURL: googleConfig.redirectURI,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { emails, displayName } = profile;
    const email = emails && emails.length > 0 ? emails[0].value : null;
    const user = await this.authService.validateGoogleUser(profile);

    if (!user) throw new UnauthorizedException()
    done(null, user);
  }
}

import { Injectable, Optional } from '@nestjs/common';
import { AuthGuard, AuthModuleOptions } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  // Nest 12 reads optional-deps metadata without inheritance, so re-declare it here.
  constructor(@Optional() options?: AuthModuleOptions) {
    super(options);
  }
}

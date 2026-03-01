import { Routes } from '@angular/router';
import { LoginPageComponent } from './pages/login-page/login-page.component';
import { CompleteProfilePageComponent } from './pages/complete-profile-page/complete-profile-page.component';
import { CardPageComponent } from './pages/card-page/card-page.component';

export const routes: Routes = [
  { path: '', component: LoginPageComponent },
  { path: 'login', component: LoginPageComponent },
  { path: 'complete-profile', component: CompleteProfilePageComponent },
  { path: 'card/:customer_code', component: CardPageComponent },
  { path: '**', redirectTo: '/' },
];

import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { appConfig } from './app/app.config';

export default function bootstrap(context: any) {
  return bootstrapApplication(App, appConfig, context);
}

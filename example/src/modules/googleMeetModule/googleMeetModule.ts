import { ModuleDecorator } from '../../core/decorators/ModuleDecorator';
import { AllInterfaces, GoogleMeetInterface } from './types/googleMeetInterfaces';
import { GoogleMeetService } from './services/googleMeetService';
import dependencyContainer from '../../core/dependencyContainer/dependencyContainer';

const googleMeetService = dependencyContainer.getService<GoogleMeetInterface>(GoogleMeetService.name);
@ModuleDecorator<AllInterfaces['interfaces']>({
   name: GoogleMeetService.name,
   url: 'https://meet.google.com/*',
   mainService: googleMeetService,
   services: {
      [GoogleMeetService.name]: googleMeetService,
   },
   setupFunction: googleMeetService.runObserve,
   executors: [
     [googleMeetService, googleMeetService.register],
   ]
})
export class GoogleMeetModule {}
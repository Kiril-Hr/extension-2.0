import { ModuleDecorator, dependencyContainer } from 'devxtension';
import { AllInterfaces, GoogleMeetInterface } from './types/googleMeetInterfaces';
import { GoogleMeetService } from './services/googleMeetService';

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

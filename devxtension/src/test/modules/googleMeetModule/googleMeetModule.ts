import {ModuleDecorator} from "../../../core";
import { GoogleMeetService } from './services/googleMeetService';
import { GoogleMeetConditionService } from './services/secondaryServices/googleMeetConditionService';

// @ts-ignore
@ModuleDecorator({
   url: 'https://meet.google.com/*',
   vanilla: {
      mainService: GoogleMeetService,
      executors: [ GoogleMeetService ]
   },
   widgets: [ GoogleMeetConditionService ]
})
export class GoogleMeetModule {}

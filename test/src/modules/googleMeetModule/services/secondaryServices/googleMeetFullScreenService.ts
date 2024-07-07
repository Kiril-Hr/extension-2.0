import {GoogleMeetFullScreenInterface, GoogleMeetUtilsInterface} from "../../types/googleMeetInterfaces";
import { ServiceDecorator } from 'devxtension';

@ServiceDecorator
export class GoogleMeetFullScreenService implements GoogleMeetFullScreenInterface {

  constructor() {}

  public enterFullScreenForParticipant = (isFullScreenEnabled, exitFullScreen) => {
    if (!isFullScreenEnabled && !exitFullScreen) {
      chrome.runtime.sendMessage({ action: 'enterFullScreen' });
      return { isFullScreenEnabledAfter: true };
    }
  };

  public checkScreenSharing = (sharedScreen, isScreenSharingActive, isFullScreenEnabled, exitFullScreen) => {
    if (sharedScreen && !isScreenSharingActive) {
      const { isFullScreenEnabledAfter } = this.enterFullScreenForParticipant(isFullScreenEnabled, exitFullScreen);
      return { isScreenSharingActive: true, isFullScreenEnabled: isFullScreenEnabledAfter }
    }
  };

}

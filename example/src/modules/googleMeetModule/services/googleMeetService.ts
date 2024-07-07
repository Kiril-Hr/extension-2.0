import {
  GoogleMeetDOMManipulationsInterface,
  GoogleMeetHasNotStarted, GoogleMeetInAnyCase,
  GoogleMeetInterface, GoogleMeetIsTakingPlace, GoogleMeetMediaInterface,

} from '../types/googleMeetInterfaces';
import {
  HappeningProps,
  HappeningPropsReturn,
} from '../types/googleMeetTypes';
import { DisableFeatures, ServiceDecorator } from '../../../core/decorators/ServiceDecorator';
import {GoogleMeetDOMManipulationsService} from "./secondaryServices/googleMeetDOMManipulationsService";
import { GoogleMeetMediaService } from './secondaryServices/googleMeetMediaService';
import { DisabledFeaturesTypes } from '../../intermediaryServices/types/intermediaryTypes';
import dependencyContainer from '../../../core/dependencyContainer/dependencyContainer';
import { InAnyCaseController } from './controllers/inAnyCaseController';
import { MeetNotStartedController } from './controllers/meetNotStartedController';
import { MeetHappeningController } from './controllers/meetHappeningController';

@ServiceDecorator
export class GoogleMeetService implements GoogleMeetInterface {
    private controllers = {
      onMeetWindow: false
    }

    private readonly DOMNodesId = {
      miniVideoId: 'mini-video'
    }

    private readonly recordParams = {
      scaleTranslationBlock: false,
    }
    private readonly conditionParams = {
      isMeeting: false,
    }

    private readonly observerTargetNode: HTMLElement = document.body;
    private readonly observerConfig: Record<string, boolean> = {
        childList: true,
        subtree: true,
    };

    constructor (
      public DOMManipulationService: GoogleMeetDOMManipulationsInterface = dependencyContainer.getService(GoogleMeetDOMManipulationsService.name),
      public MediaService: GoogleMeetMediaInterface = dependencyContainer.getService(GoogleMeetMediaService.name),
      public InAnyCase: GoogleMeetInAnyCase = dependencyContainer.getService(InAnyCaseController.name),
      public HasNotStarted: GoogleMeetHasNotStarted = dependencyContainer.getService(MeetNotStartedController.name),
      public IsTakingPlace: GoogleMeetIsTakingPlace = dependencyContainer.getService(MeetHappeningController.name)
    ) {}

    private observer = new MutationObserver( () => {
      const { belowBlockBtnExtMeeting, sharedScreen, sharingNotice, recordButton, redButton, goMessage } = this.queryDOMElements()

      const { meetingsData, currentMeetingTitle, rules, previousPartyQty, disableFeatures } = this.InAnyCase.executingInAnyCase()

      console.log(currentMeetingTitle, ` - Is meeting: ${this.conditionParams.isMeeting}`)

      const { isMeeting } = this.HasNotStarted.beforeStart({ belowBlockBtnExtMeeting, rules, meetingsData, isMeeting: this.conditionParams.isMeeting, onMeetWindow: this.controllers.onMeetWindow,
      })

      this.conditionParams.isMeeting = isMeeting

      const wrapper = DisableFeatures<DisabledFeaturesTypes, HappeningPropsReturn, GoogleMeetIsTakingPlace, HappeningProps>({
          method: this.IsTakingPlace.meetingHasStartedAndItIsHappening,
          features: disableFeatures?.meetService,
          link: this.IsTakingPlace
        }
      );

      const { onMeetWindow, scaleTranslationBlock } = wrapper({ belowBlockBtnExtMeeting, goMessage, recordButton, redButton, sharedScreen, sharingNotice, isMeeting, previousPartyQty, rules, currentMeetingTitle, meetingsData
      });

      this.controllers.onMeetWindow = onMeetWindow
      this.recordParams.scaleTranslationBlock = scaleTranslationBlock

    })

    private queryDOMElements() {
      const goMessage = Array.from(document.getElementsByClassName("VfPpkd-gIZMF"));
      const redButton = document.querySelector('[jsname="CQylAd"]');
      const sharingNotice = document.getElementsByClassName("H0YpEc")[0];
      const belowBlockBtnExtMeeting = document.querySelector('[jsaction="rcuQ6b:Rayp9d;UNIyxe:JJR6ye"]'); // this block exists on meeting page during conversation
      const sharedScreenPeers = document.getElementsByClassName("P245vb");
      const sharedScreen = sharedScreenPeers && sharedScreenPeers.length > 1 && sharedScreenPeers[0];
      const recordButton = belowBlockBtnExtMeeting?.querySelector('#record-button')

      return {
        goMessage,
        redButton,
        sharingNotice,
        belowBlockBtnExtMeeting,
        sharedScreen,
        recordButton
      }
    }

    public register() {
      document.body.addEventListener('dblclick', (e) => {
        if (this.recordParams.scaleTranslationBlock &&
          (e.target as HTMLElement).id === this.DOMNodesId.miniVideoId) {
          this.DOMManipulationService.controlBlockTranslationShow(this.MediaService.localeTranslation.id)
        }
      })
      document.body.addEventListener('dblclick', (e) => {
        if (this.recordParams.scaleTranslationBlock &&
          (e.target as HTMLElement).id === this.MediaService.localeTranslation.id) {
          this.DOMManipulationService.controlBlockTranslationHide(this.MediaService.localeTranslation.id)
        }
      })
  }

    public runObserve() {
      return this.observer.observe(this.observerTargetNode, this.observerConfig)
    }

}

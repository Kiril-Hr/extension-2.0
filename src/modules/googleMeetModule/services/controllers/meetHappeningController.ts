import {
  GoogleMeetConditionInterface,
  GoogleMeetDOMManipulationsInterface,
  GoogleMeetEventRuleInterface,
  GoogleMeetFullScreenInterface, GoogleMeetIsTakingPlace,
  GoogleMeetMainFunctionsInterface,
  GoogleMeetMediaInterface,
  GoogleMeetUtilsInterface,
} from '../../types/googleMeetInterfaces';
import dependencyContainer from '../../../../core/dependencyContainer/dependencyContainer';
import { GoogleMeetUtilsService } from '../secondaryServices/googleMeetUtilsService';
import { GoogleMeetMainFunctionsService } from '../secondaryServices/googleMeetMainFunctionsService';
import { GoogleMeetConditionService } from '../secondaryServices/googleMeetConditionService';
import { GoogleMeetMediaService } from '../secondaryServices/googleMeetMediaService';
import { GoogleMeetDOMManipulationsService } from '../secondaryServices/googleMeetDOMManipulationsService';
import { GoogleMeetFullScreenService } from '../secondaryServices/googleMeetFullScreenService';
import {
  dataTypeMainService,
  DomCustomTypes,
  HappeningProps,
  meetParticipantsTypeMainService,
} from '../../types/googleMeetTypes';
import { GoogleMeetEventRuleService } from '../secondaryServices/googleMeetEventRuleService';
import { Feature, ServiceDecorator } from '../../../../core/decorators/ServiceDecorator';

@ServiceDecorator
export class MeetHappeningController implements GoogleMeetIsTakingPlace{
  private controllers = {
    controller: 0,
    onMeetWindow: false
  }

  private CustomDOMNodes: DomCustomTypes = {
    miniVideo: null,
  }
  private readonly DOMNodesId = {
    miniVideoId: 'mini-video'
  }

  private dataParams: dataTypeMainService = {
    meetingsData: false,
    rules: null,
    currentMeetingTitle: "Topic is absent",
    exitConfigList: [],
  }
  private readonly meetParticipantsParams: meetParticipantsTypeMainService = {
    maxPartyQty: 0,
    previousPartyQty: 0,
    party: [],
    guests: [],
  }
  private readonly conditionParams = {
    leaveWithMyFriends: false,
    disabledParticipants: false,
    subtitlesOn: false,
    isCameraOff: false,
    isMeeting: false,
  }
  private readonly fullScreenParams  = {
    exitFullScreen: false,
    isFullScreenEnabled: false,
    isScreenSharingActive: false,
    DOMSubtitlesChanged: false,
  }
  private readonly recordParams = {
    hasRecordBegun: false,
    scaleTranslationBlock: false,
    animationKeyframes: document.styleSheets[0].insertRule(`
        @keyframes recordButtonAnimation {
          0% {
            transform: scale(1, 1);
          }
          50% {
            transform: scale(1.2, 1.2);
          }
          100% {
            transform: scale(1, 1);
          }
        }
      `, document.styleSheets[0].cssRules.length),
    styleAnimation: {
      animationName: 'recordButtonAnimation',
      animationDuration: '2s',
      animationTimingFunction: 'ease-in-out',
      animationIterationCount: 'infinite',
      boxShadow: '0px 0px 4px 3px rgba(165,42,42,0.4)',
    }
  }

  constructor(
    public UtilsService: GoogleMeetUtilsInterface  = dependencyContainer.getService(GoogleMeetUtilsService.name),
    public MainFunctionsService: GoogleMeetMainFunctionsInterface = dependencyContainer.getService(GoogleMeetMainFunctionsService.name),
    public ConditionService: GoogleMeetConditionInterface = dependencyContainer.getService(GoogleMeetConditionService.name),
    public MediaService: GoogleMeetMediaInterface = dependencyContainer.getService(GoogleMeetMediaService.name),
    public DOMManipulationService: GoogleMeetDOMManipulationsInterface = dependencyContainer.getService(GoogleMeetDOMManipulationsService.name),
    public FullScreenService: GoogleMeetFullScreenInterface = dependencyContainer.getService(GoogleMeetFullScreenService.name),
    public RuleService: GoogleMeetEventRuleInterface = dependencyContainer.getService(GoogleMeetEventRuleService.name),
  ) {}

  public meetingHasStartedAndItIsHappening({ belowBlockBtnExtMeeting, redButton, sharedScreen, sharingNotice, recordButton, goMessage, isMeeting, previousPartyQty, rules, currentMeetingTitle, meetingsData }: HappeningProps) {

    this.setupMeetingData(meetingsData, currentMeetingTitle, isMeeting, rules, previousPartyQty, belowBlockBtnExtMeeting)

    this.handleCameraOff(belowBlockBtnExtMeeting)

    this.handleSubtitles(belowBlockBtnExtMeeting)

    this.keepTabActive()

    this.updatePartyInformation()

    this.handleExitMeeting(redButton, goMessage, sharingNotice)

    this.handleFullScreen(sharingNotice)

    this.handleRecording(recordButton, belowBlockBtnExtMeeting)

    this.scaleTranslationBlock(sharingNotice)

    this.manageMiniVideo(sharingNotice)

    this.updateScreenSharingStatus(sharedScreen, sharingNotice)

    this.manageDOMSubtitles()

    return {
      onMeetWindow: this.controllers.onMeetWindow,
      scaleTranslationBlock: this.recordParams.scaleTranslationBlock,
    }
  }

  private setupMeetingData (meetingsData, currentMeetingTitle, isMeeting, rules, previousPartyQty, belowBlockBtnExtMeeting
  ) {
    this.dataParams.meetingsData = meetingsData;
    this.dataParams.currentMeetingTitle = currentMeetingTitle;
    this.conditionParams.isMeeting = isMeeting;
    this.dataParams.rules = rules;

    if (!isMeeting) this.meetParticipantsParams.previousPartyQty = previousPartyQty;

    if (belowBlockBtnExtMeeting) this.controllers.onMeetWindow = true
  }

  private handleCameraOff(belowBlockBtnExtMeeting) {
    if (belowBlockBtnExtMeeting && this.dataParams.rules?.joinWithCameraOff && !this.conditionParams.isCameraOff) {
      (async () => {
        const { cameraUI, isCameraOff, cameraBtn } = await this.DOMManipulationService.disableCamera(belowBlockBtnExtMeeting)
        this.conditionParams.isCameraOff = isCameraOff

        this.UtilsService.delay(() => {
          const isCameraOn = cameraUI?.getAttribute('class').includes('HotEze')
          this.conditionParams.isCameraOff && isCameraOn && (this.DOMManipulationService.turnOnOffCameraHandle(cameraBtn))
        }, 2000)
      })();
    }
  }

  private handleSubtitles(belowBlockBtnExtMeeting) {
    if (belowBlockBtnExtMeeting && this.dataParams.rules?.showSubtitles && !this.conditionParams.subtitlesOn) {
      try {
        const settingsMenu = Array.from((belowBlockBtnExtMeeting.childNodes[1] as HTMLDivElement)?.querySelector('div').childNodes).reverse()[1]

        if (settingsMenu) {
          this.UtilsService.delay(() => this.UtilsService.onSubtitles(settingsMenu as HTMLElement), 3000);
          this.conditionParams.subtitlesOn = true;
        }
      } catch (e) {}
    }
  }

  private keepTabActive() {
    if (this.dataParams.rules?.keepTabActive && this.conditionParams.isMeeting) {
      chrome.runtime.sendMessage({ action: 'keepTabActive' }); // there is a problem with moving to another tab when you are clicking and pressing mouse`s left button on tab which is not google meet, I added in background.js delay when the chrome event is checking moment of moving to another page, the event is called OnActivate
    }
  }

  private updatePartyInformation() {
    this.meetParticipantsParams.maxPartyQty = this.meetParticipantsParams.party.length;

    this.meetParticipantsParams.party = this.MainFunctionsService.getParty()
      .length - this.meetParticipantsParams.party.length > 1 ? this.meetParticipantsParams.party : this.MainFunctionsService.getParty() // way to avoid breaking and ending meet on extension user side after has been finished translating by him/her
    //console.log(this.meetParticipantsParams.party, '----------------------------> PARTY')

    const currentGuests = this.MainFunctionsService.guestsHandler(this.dataParams.exitConfigList, this.meetParticipantsParams.party)
    if (!this.meetParticipantsParams.guests.length && currentGuests) {
      this.meetParticipantsParams.guests = this.MainFunctionsService.guestsHandler(this.dataParams.exitConfigList, this.meetParticipantsParams.party);
    } else if (this.meetParticipantsParams.guests.length < currentGuests?.length) {
      this.meetParticipantsParams.guests = currentGuests
    }
  }

  private handleExitMeeting(redButton, goMessage, sharingNotice) {
    this.conditionParams.leaveWithMyFriends = Boolean(this.ConditionService.leaveWithMyFriendsHandle(this.dataParams.meetingsData, this.dataParams.rules, this.meetParticipantsParams.party));

    const checkExit = this.RuleService.checkIfConfigRule(this.dataParams.currentMeetingTitle, this.dataParams.exitConfigList, this.meetParticipantsParams.guests, this.meetParticipantsParams.party, this.dataParams.rules.percentageToLeave);
    //console.log(checkExit, '----------------------------------- > checkExit');
    if ((checkExit || this.meetParticipantsParams.party.length === 2) && this.meetParticipantsParams.maxPartyQty < this.meetParticipantsParams.previousPartyQty) {
      this.ConditionService.exitMeeting(redButton, this.meetParticipantsParams.party, this.dataParams.exitConfigList, this.conditionParams.isMeeting, this.controllers.controller);
    }

    this.meetParticipantsParams.previousPartyQty = this.meetParticipantsParams.maxPartyQty

    if (goMessage[0] || sharingNotice) {
      this.meetParticipantsParams.party = this.MainFunctionsService.getParty();
      setTimeout(() => {
        if (this.ConditionService.checkIfAlone(this.meetParticipantsParams.party) || this.ConditionService.checkIfAloneAndScreenSharing(this.meetParticipantsParams.party)) {
          this.ConditionService.exitMeeting(redButton, this.meetParticipantsParams.party, this.dataParams.exitConfigList, this.conditionParams.isMeeting, this.controllers.controller);
        }
      }, 3000);
    }
  }

  private handleFullScreen(sharingNotice) {
    this.fullScreenParams.isFullScreenEnabled && window.addEventListener('keydown', (e) => {
      if (e.key === 'F11') this.fullScreenParams.exitFullScreen = true
    })

    if (!sharingNotice) {
      this.fullScreenParams.isFullScreenEnabled = false
      this.fullScreenParams.isScreenSharingActive = false
      this.MediaService.deleteLocalTranslationBlock()
    }

    if (!sharingNotice && this.fullScreenParams.isScreenSharingActive) {
      chrome.runtime.sendMessage({ action: 'disableFullScreen' })
      this.fullScreenParams.isScreenSharingActive = false
    }
  }

  @Feature('disableRecordFeature')
  private handleRecording(recordButton, belowBlockBtnExtMeeting) {
    if (!this.recordParams.hasRecordBegun && recordButton) {
      const span = recordButton?.querySelector('span');
      Object.entries(this.recordParams.styleAnimation).forEach(([style]) => span.style[style] = '')
    } else if (this.recordParams.hasRecordBegun && recordButton) {
      const span = recordButton?.querySelector('span');
      Object.entries(this.recordParams.styleAnimation).forEach(([style, value]) => span.style[style] = value)
    }

    if (belowBlockBtnExtMeeting && !recordButton) {
      const recordButton = this.DOMManipulationService.createRecordButton(belowBlockBtnExtMeeting)

      this.UtilsService.handleManyClick(recordButton, 1, async () => {
        if (this.recordParams.hasRecordBegun) {
          this.recordParams.hasRecordBegun = false
          this.MediaService.stopRecording()
        } else {
          await this.MediaService.startRecording()
          this.recordParams.hasRecordBegun = true
        }
      })
    }
  }

  private scaleTranslationBlock(sharingNotice) {
    if (!this.recordParams.scaleTranslationBlock && sharingNotice) {
      const video = document.querySelectorAll('.Gv1mTb-aTv5jf')[0] as HTMLVideoElement

      video && this.MediaService.scaleNewTranslationBlock(video)
      this.recordParams.scaleTranslationBlock = true
    }
  }

  private manageMiniVideo(sharingNotice) {
    if (sharingNotice) {
      this.CustomDOMNodes.miniVideo = document.querySelectorAll('[jscontroller="h8UR3d"]')[0] as HTMLElement;
      this.CustomDOMNodes.miniVideo.id = this.DOMNodesId.miniVideoId;
    }
  }

  private updateScreenSharingStatus(sharedScreen, sharingNotice) {
    if (sharingNotice) {
      const checkScreenSharing = this.FullScreenService.checkScreenSharing(sharedScreen, this.fullScreenParams.isScreenSharingActive, this.fullScreenParams.isFullScreenEnabled, this.fullScreenParams.exitFullScreen)

      checkScreenSharing && (this.fullScreenParams.isScreenSharingActive = checkScreenSharing.isScreenSharingActive)
      checkScreenSharing && (this.fullScreenParams.isFullScreenEnabled = checkScreenSharing.isFullScreenEnabled)
    }
  }

  private manageDOMSubtitles() {
    if (this.fullScreenParams.isFullScreenEnabled && this.fullScreenParams.isScreenSharingActive && !this.fullScreenParams.DOMSubtitlesChanged) {
      this.fullScreenParams.DOMSubtitlesChanged = this.DOMManipulationService.manageSubtitles()
    }
  }

}

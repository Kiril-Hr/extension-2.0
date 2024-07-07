import { dataTypeMainService, MeetingsData, meetParticipantsTypeMainService } from '../../types/googleMeetTypes';
import { GoogleMeetInAnyCase, GoogleMeetMainFunctionsInterface } from '../../types/googleMeetInterfaces';
import dependencyContainer from '../../../../core/dependencyContainer/dependencyContainer';
import { GoogleMeetMainFunctionsService } from '../secondaryServices/googleMeetMainFunctionsService';
import { GeneralIntermediaryInterface } from '../../../intermediaryServices/types/generalIntermediaryInterface';
import GeneralIntermediary from '../../../intermediaryServices/intermediaryService';
import { DisabledFeaturesTypes } from '../../../intermediaryServices/types/intermediaryTypes';
import { ServiceDecorator } from '../../../../core/decorators/ServiceDecorator';

@ServiceDecorator
export class InAnyCaseController implements GoogleMeetInAnyCase {
  private meetParticipantsParams: Pick<meetParticipantsTypeMainService, 'previousPartyQty'> = {
    previousPartyQty: 0
  }
  private disableFeatures: DisabledFeaturesTypes | null = null
  private dataParams: Omit<dataTypeMainService, 'exitConfigList'> = {
    meetingsData: false,
    rules: null,
    currentMeetingTitle: "Topic is absent",
  }

  constructor(
    public IntermediaryService: GeneralIntermediaryInterface = GeneralIntermediary,
    public MainFunctionsService: GoogleMeetMainFunctionsInterface = dependencyContainer.getService(GoogleMeetMainFunctionsService.name),
  ) {}

  public executingInAnyCase() {
    this.dataParams.currentMeetingTitle = this.MainFunctionsService.getMeetTopic(this.dataParams.meetingsData) // function for processing meeting name depends on local time

    this.dataParams.rules = this.dataParams.meetingsData && Object.values((this.dataParams.meetingsData as MeetingsData).googlemeetRules).find(m => m.title === this.dataParams.currentMeetingTitle).rules

    if (!this.dataParams.meetingsData) (async () => {
      const { meetService, disabledFeatures } = await this.IntermediaryService.rulesIntermediaryService.getRules()

      this.dataParams.meetingsData = meetService
      this.disableFeatures = disabledFeatures

      this.meetParticipantsParams.previousPartyQty = Object.values((this.dataParams.meetingsData as MeetingsData).googlemeetRules).find(m => m.title === this.dataParams.currentMeetingTitle)?.rules.autoJoinParticipantsQuantity
    })();

    return {
      currentMeetingTitle: this.dataParams.currentMeetingTitle,
      rules: this.dataParams.rules,
      meetingsData: this.dataParams.meetingsData,
      disableFeatures: this.disableFeatures,
      previousPartyQty: this.meetParticipantsParams.previousPartyQty
    }
  }

}

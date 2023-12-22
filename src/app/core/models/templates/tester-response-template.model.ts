import { IssueComment } from '../comment.model';
import { GithubComment } from '../github/github-comment.model';
import { TesterResponse } from '../tester-response.model';
import { buildTeamResponseSectionParser } from './section-parsers/common-parsers.model';
import { TesterResponseSectionParser } from './section-parsers/tester-response-section-parser.model';
import { Template } from './template.model';

const { coroutine, many1, str, optionalWhitespace, possibly, whitespace } = require('arcsecond');

interface TesterResponseParseResult {
  teamResponse: string;
  testerResponses: TesterResponse[];
  testerDisagree: boolean;
  teamChosenSeverity: string;
  teamChosenType: string;
  teamChosenResponse: string;
}

const GITHUB_UI_EDIT_WARNING =
  '[IMPORTANT!: Please do not edit or reply to this comment using the GitHub UI. You can respond to it using CATcher during the next phase of the PE]';
const TESTER_RESPONSES_HEADER = '# Items for the Tester to Verify';
const DISAGREE_CHECKBOX_DESCRIPTION = 'I disagree';

const TeamResponseSectionParser = buildTeamResponseSectionParser(TESTER_RESPONSES_HEADER);

export const TesterResponseParser = coroutine(function* () {
  yield possibly(str(GITHUB_UI_EDIT_WARNING));
  yield optionalWhitespace;

  const teamResponse = yield TeamResponseSectionParser;

  // parse tester responses from comment
  yield str(TESTER_RESPONSES_HEADER);
  yield whitespace;
  const responses = yield many1(TesterResponseSectionParser);

  // build array of TesterResponse
  let testerDisagree = false;
  let teamChosenSeverity: string;
  let teamChosenType: string;
  let teamChosenResponse: string;
  const testerResponses: TesterResponse[] = [];

  for (const response of responses) {
    if (response.disagreeCheckboxValue) {
      testerDisagree = true;
    }

    if (response.title === 'severity') {
      teamChosenSeverity = response.teamChose;
    } else if (response.title === 'type') {
      teamChosenType = response.teamChose;
    } else if (response.title === 'response') {
      teamChosenResponse = response.teamChose;
    }

    testerResponses.push(
      new TesterResponse(
        'Issue ' + response.title,
        response.description,
        DISAGREE_CHECKBOX_DESCRIPTION,
        response.disagreeCheckboxValue,
        response.reasonForDisagreement
      )
    );
  }

  const result: TesterResponseParseResult = {
    teamResponse: teamResponse,
    testerResponses: testerResponses,
    testerDisagree: testerDisagree,
    teamChosenSeverity: teamChosenSeverity,
    teamChosenType: teamChosenType,
    teamChosenResponse: teamChosenResponse
  };
  return result;
});

export class TesterResponseTemplate extends Template {
  teamResponse: string;
  testerResponses: TesterResponse[];
  testerDisagree: boolean;
  comment: IssueComment;
  teamChosenSeverity?: string;
  teamChosenType?: string;
  teamChosenResponse?: string;

  constructor(githubComments: GithubComment[]) {
    super(TesterResponseParser);

    const templateConformingComment = this.findConformingComment(githubComments);

    if (this.parseFailure) {
      return;
    }

    this.comment = <IssueComment>{
      ...templateConformingComment,
      description: templateConformingComment.body
    };

    this.teamResponse = this.parseResult.teamResponse;
    this.testerResponses = this.parseResult.testerResponses;
    this.testerDisagree = this.parseResult.testerDisagree;
    this.teamChosenSeverity = this.parseResult.teamChosenSeverity;
    this.teamChosenType = this.parseResult.teamChosenType;
    this.teamChosenResponse = this.parseResult.teamChosenResponse;
  }
}

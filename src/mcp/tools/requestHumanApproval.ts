/**
 * Tool: request_human_approval
 *
 * A structured "gold gate" the agent calls before any irreversible action
 * (i.e. opening a PR). It records a decision request with a clear summary of
 * the confirmed vulnerability and the proposed fix.
 *
 * IMPORTANT — defence in depth:
 * This tool produces the human-readable case for approval, but the *binding*
 * gate is TrueForge's own native approval mechanism: `create_patch_pr` is
 * listed under `require_approval_for_tools` in the agent spec, so the harness
 * physically pauses and emits a `tool.approval_required` event that a human
 * must allow before the PR tool ever executes. This tool makes that decision
 * well-informed; the harness makes it enforceable.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { guard } from '../guard.js';
import { requestApprovalShape } from '../schemas.js';

export function registerRequestHumanApproval(server: McpServer): void {
  server.registerTool(
    'request_human_approval',
    {
      title: 'Request human approval (gold gate)',
      description:
        'Present a confirmed vulnerability and the proposed patch to a human for sign-off ' +
        'BEFORE any repository change. Call this once the exploit is confirmed and a fix is ' +
        'drafted, then stop and wait — the harness will pause for the human decision.',
      inputSchema: requestApprovalShape,
    },
    guard('request_human_approval', async (req) => {
      // We return a normalised approval-request record. The harness surfaces
      // this to the operator and gates the subsequent create_patch_pr call.
      const record = {
        status: 'awaiting_human_decision',
        requestedAt: new Date().toISOString(),
        ...req,
      };
      return {
        content: [{
          type: 'text',
          text:
            'APPROVAL REQUESTED — the workflow is paused pending a human decision.\n\n' +
            JSON.stringify(record, null, 2),
        }],
      };
    }),
  );
}

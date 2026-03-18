import { RunStatus } from '../../../common/enums/run-status.enum';

export const TERMINAL_RUN_STATUSES: ReadonlySet<RunStatus> = new Set([
  RunStatus.COMPLETED,
  RunStatus.FAILED,
  RunStatus.CANCELLED,
]);

export const VALID_RUN_TRANSITIONS: Readonly<Record<RunStatus, RunStatus[]>> = {
  [RunStatus.PENDING]: [RunStatus.RUNNING, RunStatus.CANCELLED],
  [RunStatus.RUNNING]: [RunStatus.COMPLETED, RunStatus.FAILED, RunStatus.CANCELLED],
  [RunStatus.COMPLETED]: [],
  [RunStatus.FAILED]: [],
  [RunStatus.CANCELLED]: [],
};

export function isValidRunTransition(from: string, to: string): boolean {
  return VALID_RUN_TRANSITIONS[from as RunStatus]?.includes(to as RunStatus) ?? false;
}

export function isTerminalRunStatus(status: string): boolean {
  return TERMINAL_RUN_STATUSES.has(status as RunStatus);
}

import { MATCH_STATUS } from '../validation/matches.js';

export function getMatchStatus(startTime, endTime, now = new Date()) {
    const start = new Date(startTime);

    // If start is invalid, we can't compute.
    if (Number.isNaN(start.getTime())) return null;

    // Without a valid endTime we cannot safely infer "finished".
    // Let caller keep persisted/provider status in that case.
    if (endTime == null) return null;

    const end = new Date(endTime);

    if (Number.isNaN(end.getTime())) return null;

    if (now < start) return MATCH_STATUS.SCHEDULED;
    if (now >= end) return MATCH_STATUS.FINISHED;
    return MATCH_STATUS.LIVE;
}

export async function syncMatchStatus(match, updateStatus) {
    const nextStatus = getMatchStatus(match.startTime, match.endTime);
    if (!nextStatus) return match.status;

    if (match.status !== nextStatus) {
        await updateStatus(nextStatus);
        match.status = nextStatus;
    }
    return match.status;
}

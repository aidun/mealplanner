package mailer

import "context"

type Noop struct{}

func (Noop) SendInviteEmail(context.Context, InviteEmail) error {
	return nil
}

func (Noop) SendPremiumInviteEmail(context.Context, PremiumInviteEmail) error {
	return nil
}

func (Noop) SendWeeklyPlanReadyEmail(context.Context, WeeklyPlanReadyEmail) error {
	return nil
}

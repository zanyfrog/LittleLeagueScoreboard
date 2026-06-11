# @ll-score/iam-client

HTTP implementation of the shared `IamService` contract. Landing and future
containers use this package when I-AM runs out of process.

It supports bootstrap status, login/logout, cookie or explicit session
identity, `auth/me`, authorization decisions, users, scoped permission
assignments, explicit restrictions, and development-profile login.

The client contains no policy decisions. Local and hosted I-AM implementations
must return the same contract shapes and stable reason codes.

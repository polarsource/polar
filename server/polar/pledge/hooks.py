from polar.kit.hook import Hook
from polar.models.pledge import Pledge

pledge_created: Hook[Pledge] = Hook()
pledge_disputed: Hook[Pledge] = Hook()

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

from polar.kit.schemas import Int32, Schema
from polar.void.deploy.schemas import DeployConfiguration

StageRevision = Annotated[Int32, Field(ge=1)]


class Stage(Schema):
    revision: StageRevision
    configuration: DeployConfiguration


class StageConfiguration(DeployConfiguration):
    model_config = ConfigDict(extra="forbid")


class StageSave(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_revision: StageRevision | None = Field(
        description="The last read revision, or None to create a stage."
    )
    configuration: StageConfiguration


class StageDeploy(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_revision: StageRevision
    dry_run: bool = Field(False, description="Plan the deployment without writing.")

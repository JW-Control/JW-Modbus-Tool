import {
  createSlaveDataModel,
  handleRtuSlaveRequest,
  type SlaveDataModel,
  type SlaveFrameResult
} from "../../shared/modbus/slaveResponses.js";

export class RtuSlaveSession {
  readonly dataModel: SlaveDataModel;

  constructor(
    private readonly unitId: number,
    dataModel: SlaveDataModel = createSlaveDataModel()
  ) {
    this.dataModel = dataModel;
  }

  handleFrame(frame: Uint8Array): SlaveFrameResult {
    return handleRtuSlaveRequest(frame, this.dataModel, { unitId: this.unitId });
  }
}

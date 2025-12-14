export class WsResponse<T> {
  event: string;
  data: T;

  constructor(event: string, data: T) {
    this.event = event;
    this.data = data;
  }
}

export interface WsErrorResponse {
  code: string;
  message: string;
}

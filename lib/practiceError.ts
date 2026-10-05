export class PracticeError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

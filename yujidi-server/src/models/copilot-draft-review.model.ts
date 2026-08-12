import { model, Schema } from "mongoose";

export const copilotDraftReviewSchema = new Schema(
  {
    reviewId: { type: String, required: true, trim: true, maxlength: 160 },
    reviewVersion: { type: Number, required: true, min: 1 },
    ownerId: { type: String, required: true, trim: true, maxlength: 160, index: true },
    generation: { type: Schema.Types.Mixed, required: true },
    bindings: {
      type: [
        {
          _id: false,
          bindingReviewId: { type: String, required: true, trim: true, maxlength: 160 },
          bindingCandidateId: { type: String, required: true, trim: true, maxlength: 160 },
          label: { type: String, required: true, trim: true, maxlength: 200 },
          relationship: { type: String, required: true, enum: ["DIRECT", "INVERSE"] },
        },
      ],
      required: true,
    },
    createdAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date, default: null },
    acceptedTemplateId: { type: String, default: null },
  },
  { strict: "throw", versionKey: false },
);

copilotDraftReviewSchema.index({ reviewId: 1, reviewVersion: 1 }, { unique: true });
copilotDraftReviewSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const CopilotDraftReviewModel = model(
  "CopilotDraftReview",
  copilotDraftReviewSchema,
);

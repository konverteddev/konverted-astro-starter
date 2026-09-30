import { type MediaFragmentResult, media } from "~/features/sanity/media/fragment";

export const MediaBlockFragment = `
_type == "mediaBlock" => {
  caption,
  useParallax,
  "media": ${media("appMedia")},
}
`;

export type MediaBlockFragmentResult = {
  caption?: string;
  useParallax?: boolean;
  media?: MediaFragmentResult;
};

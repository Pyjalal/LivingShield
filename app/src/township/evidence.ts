import type { TownshipId } from './model';
export const PILOT_EVIDENCE: Record<
  TownshipId,
  { label: string; text: string; url: string; source: string }
> = {
  'bukit-raja': {
    label: 'Documented flood history',
    text: 'Sime Darby records households affected in the 2021 floods. Parliament also discussed flooding on Bandar Bukit Raja routes on 12 November 2024. These records do not identify inundated buildings in this view.',
    url: 'https://www.parlimen.gov.my/files/hindex/pdf/DR-05022025.pdf#page=122',
    source: 'Parliament · 5 February 2025, p122',
  },
  pagoh: {
    label: 'Climate-risk pilot',
    text: 'Sime Darby’s 2025 assessment identifies flood exposure at Bandar Universiti Pagoh. Historical relief reporting names the wider Pagoh area; it does not establish which township properties flooded.',
    url: 'https://www.simedarbyproperty.com/sites/default/files/2026-04/SDP%20SR2025%20%28Mobile%29.pdf#page=93',
    source: 'Sime Darby Property · Sustainability Report 2025, p87',
  },
  elmina: {
    label: 'Resilience comparator',
    text: 'A Sime Darby township with green infrastructure and planned floodplain functions. Included to compare planning options; nearby flood reports are not evidence that the buildings shown here flooded.',
    url: 'https://www.simedarbyproperty.com/press-releases/tn50-aspirations-realisation-sime-darby-property-launches-city-elmina-townships?id=&thankyou=true',
    source: 'Sime Darby Property · City of Elmina announcement',
  },
};

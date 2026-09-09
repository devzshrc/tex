import type { ComponentProps } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowRightToLineIcon,
  ArrowUp01Icon,
  Attachment01Icon,
  Calendar01Icon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
  CheckmarkSquare01Icon,
  Clock01Icon,
  Copy01Icon,
  DashboardSquare01Icon,
  Download01Icon,
  FavouriteIcon,
  File01Icon,
  Home01Icon,
  ImageAdd01Icon,
  KanbanIcon,
  KeyboardIcon,
  Logout01Icon,
  MailAdd01Icon,
  MoreHorizontalIcon,
  PencilEdit01Icon,
  PlusSignIcon,
  Search01Icon,
  Settings01Icon,
  SidebarLeft01Icon,
  StarIcon,
  Tag01Icon,
  Task01Icon,
  TextAlignLeftIcon,
  ThumbsUpIcon,
} from "@hugeicons/core-free-icons";

type IconProps = Omit<ComponentProps<typeof HugeiconsIcon>, "icon">;

function icon(iconData: ComponentProps<typeof HugeiconsIcon>["icon"]) {
  return function AppIcon(props: IconProps) {
    return <HugeiconsIcon icon={iconData} {...props} />;
  };
}

export const AlignLeft = icon(TextAlignLeftIcon);
export const ArrowRight = icon(ArrowRight01Icon);
export const ArrowRightToLine = icon(ArrowRightToLineIcon);
export const Calendar = icon(Calendar01Icon);
export const CalendarDays = icon(Calendar01Icon);
export const Check = icon(CheckmarkCircle01Icon);
export const CheckIcon = icon(CheckmarkSquare01Icon);
export const CheckSquare = icon(Task01Icon);
export const ChevronDown = icon(ArrowDown01Icon);
export const ChevronDownIcon = icon(ArrowDown01Icon);
export const ChevronLeft = icon(ArrowLeft01Icon);
export const ChevronRight = icon(ArrowRight01Icon);
export const ChevronUpIcon = icon(ArrowUp01Icon);
export const Clock = icon(Clock01Icon);
export const Copy = icon(Copy01Icon);
export const Download = icon(Download01Icon);
export const FileText = icon(File01Icon);
export const House = icon(Home01Icon);
export const ImagePlus = icon(ImageAdd01Icon);
export const Keyboard = icon(KeyboardIcon);
export const LayoutTemplate = icon(DashboardSquare01Icon);
export const ListChecks = icon(Task01Icon);
export const LogOut = icon(Logout01Icon);
export const MailPlus = icon(MailAdd01Icon);
export const MoreHorizontal = icon(MoreHorizontalIcon);
export const PanelLeft = icon(SidebarLeft01Icon);
export const Paperclip = icon(Attachment01Icon);
export const Pencil = icon(PencilEdit01Icon);
export const Plus = icon(PlusSignIcon);
export const Search = icon(Search01Icon);
export const SlidersHorizontal = icon(Settings01Icon);
export const SquareKanban = icon(KanbanIcon);
export const Star = icon(StarIcon);
export const Tag = icon(Tag01Icon);
export const ThumbsUp = icon(ThumbsUpIcon);
export const X = icon(Cancel01Icon);
export const XIcon = icon(Cancel01Icon);

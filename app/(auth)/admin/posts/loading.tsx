import { ListSkeleton } from "@/components/shared/skeletons";

export default function Loading() {
  return (
    <div className="p-1">
      <ListSkeleton rows={5} />
    </div>
  );
}

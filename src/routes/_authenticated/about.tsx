import { createFileRoute } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/about")({
  head: () => ({
    meta: [
      { title: "من نحن - Reflect" },
      { name: "description", content: "براند مصري محلي متخصص في الملابس العصرية بأسعار مناسبة." },
      { property: "og:title", content: "من نحن - Reflect" },
      { property: "og:description", content: "براند مصري محلي متخصص في الملابس العصرية بأسعار مناسبة." },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  const { t, lang } = useI18n();
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-6">
      <h1 className="text-3xl font-bold">{t("about")}</h1>
      <div className="rounded-xl border bg-card p-6 space-y-4 text-sm leading-7">
        {lang === "ar" ? (
          <>
            <p>
              <strong>Reflect</strong> براند مصري محلي متخصص في الملابس العصرية للرجال والنساء
              بجودة عالية وأسعار في متناول الجميع. بدأنا كفكرة بسيطة: نقدم قطع أساسية
              وأنيقة تعكس ذوق الشارع المصري بلمسة معاصرة.
            </p>
            <p>
              كل قطعة يتم اختيارها وتصميمها بعناية داخل مصر، وبنعمل على توفير تجربة تسوّق
              مريحة أونلاين مع خدمة عملاء سريعة، وطرق دفع مرنة تشمل الدفع عند الاستلام.
            </p>
            <p>
              رسالتنا: نلبس المصريين ملابس بجودة عالمية بأسعار محلية.
            </p>
          </>
        ) : (
          <>
            <p>
              <strong>Reflect</strong> is a local Egyptian clothing brand offering trendy pieces
              for men and women at fair prices. We started with a simple idea: essentials that
              reflect Egyptian street style with a modern touch.
            </p>
            <p>
              Every piece is carefully curated in Egypt, and we provide a smooth online shopping
              experience, responsive support, and flexible payment options including cash on delivery.
            </p>
            <p>Our mission: dress Egypt with world-class quality at local prices.</p>
          </>
        )}
      </div>
    </div>
  );
}

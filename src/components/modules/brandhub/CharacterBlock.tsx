import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { brandData } from "./BrandHubData";

export function CharacterBlock() {
  return (
    <div className="space-y-4" id="cheatsheet">
      <h2 className="text-xl font-semibold">Характер и Тональность</h2>
      
      <div className="grid md:grid-cols-2 gap-6">
        {/* Character */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Характер</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {brandData.character.map((item) => (
              <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50">
                <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                <div>
                  <p className="font-medium text-sm">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Tonality */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Тональность</CardTitle>
            <p className="text-xs text-muted-foreground">Как мы звучим</p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-4">
              {brandData.tonality.map((item) => (
                <Badge key={item.id} variant="secondary" className="px-3 py-1.5">
                  {item.title}
                </Badge>
              ))}
            </div>
            <div className="space-y-2">
              {brandData.tonality.map((item) => (
                <div key={item.id} className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{item.title}:</span>
                  <span className="text-muted-foreground">{item.description}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Brain, Heart } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { brandData } from "./BrandHubData";

export function BenefitsBlock() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Преимущества</h2>
      
      <Tabs defaultValue="rational" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="rational" className="flex items-center gap-2">
            <Brain className="w-4 h-4" />
            <span className="hidden sm:inline">Рациональные</span>
            <span className="sm:hidden">Рац.</span>
          </TabsTrigger>
          <TabsTrigger value="emotional" className="flex items-center gap-2">
            <Heart className="w-4 h-4" />
            <span className="hidden sm:inline">Эмоциональные</span>
            <span className="sm:hidden">Эмоц.</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rational" className="mt-4">
          <div className="grid md:grid-cols-3 gap-4">
            {brandData.benefits.rational.map((benefit) => (
              <Card key={benefit.id} className="overflow-hidden border-l-4 border-l-primary">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{benefit.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1.5">
                    {benefit.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="emotional" className="mt-4">
          <div className="grid md:grid-cols-3 gap-4">
            {brandData.benefits.emotional.map((benefit) => (
              <Card key={benefit.id} className="overflow-hidden border-l-4 border-l-accent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{benefit.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1.5">
                    {benefit.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0 mt-1.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

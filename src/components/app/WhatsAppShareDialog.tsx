import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Share2, MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { waLink } from "@/lib/format";

export function WhatsAppShareDialog({
  open, onOpenChange, title = "Mensagem WhatsApp", message, phone: initialPhone = "",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: string;
  message: string;
  phone?: string;
}) {
  const [msg, setMsg] = useState(message);
  const [phone, setPhone] = useState(initialPhone);

  // Sincroniza o conteúdo sempre que o diálogo é reaberto com outra mensagem/telefone
  useEffect(() => {
    if (open) {
      setMsg(message);
      setPhone(initialPhone);
    }
  }, [open, message, initialPhone]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(msg); toast.success("Mensagem copiada"); }
    catch { toast.error("Não foi possível copiar"); }
  };

  const share = async () => {
    if ((navigator as any).share) {
      try { await (navigator as any).share({ text: msg }); return; } catch { /* fallthrough */ }
    }
    copy();
  };

  const sendWhats = () => {
    window.open(waLink(phone, msg), "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Telefone (opcional)</Label>
            <Input placeholder="Ex.: 5511999999999" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <Label>Mensagem</Label>
            <Textarea rows={10} value={msg} onChange={(e) => setMsg(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={copy}><Copy className="h-4 w-4 mr-2" /> Copiar</Button>
          <Button variant="outline" onClick={share}><Share2 className="h-4 w-4 mr-2" /> Compartilhar</Button>
          <Button onClick={sendWhats}><MessageCircle className="h-4 w-4 mr-2" /> WhatsApp</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

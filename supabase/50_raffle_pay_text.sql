-- Rifa: o texto de como pagar passa a ser escrito por você (em cada rifa), porque a cobrança pode ser no jogo ou pelo Discord.
-- Se ficar vazio, a página mostra uma frase padrão. Pode ser alterado enquanto a rifa estiver aberta. É seguro rodar de novo.

alter table public.raffles add column if not exists pay_text text not null default '' check (char_length(pay_text) <= 1500);

-- Conferência: a coluna existe.
select count(*) as rifas, count(*) filter (where pay_text <> '') as com_texto_de_pagamento from public.raffles;

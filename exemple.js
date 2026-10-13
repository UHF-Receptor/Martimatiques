// Fitxa d'exemple que es carrega en el mode de prova
export const FITXA_EXEMPLE = String.raw`\documentclass[12pt,a4paper,oneside]{article}
\usepackage{amsmath}
\newcommand{\sol}{{\it Resposta: }}
\begin{document}
\font\capsal=cmbx12
{\capsal
\noindent{\centre}\hfill 4t d'ESO

\noindent{Matemàtiques}\hfill Curs acadèmic: \curs
\vskip .1 cm\hrule}
\section{Potències, radicals i logaritmes}

\begin{enumerate}
    \item Simplifiqueu fins a obtenir una única potència o un nombre.
    \begin{enumerate}[label=\alph*)]
    \item $\left(2^3\right)^{-2}=$ \hfill \sol{$\dfrac{1}{64}$}
    \item $\left[\left(3^{-2}\right)^3\right]^{-1}=$ \hfill \sol{$3^6$}
    \item $\left(\dfrac{a^{-2}b^3}{a^3b^{-2}}\right)^{-1}=$ \hfill \sol{$\dfrac{a^5}{b^5}$}
    \end{enumerate}

    \item Calculeu i simplifieu els radicals.
    \begin{enumerate}[label=\alph*)]
    \item $\sqrt{50}=$ \hfill \sol{$5\sqrt{2}$}
    \item $\sqrt[3]{-125}=$ \hfill \sol{$-5$}
    \item $\sqrt{12}+\sqrt{27}=$ \hfill \sol{$5\sqrt{3}$}
    \item Racionalitzeu: $\dfrac{6}{\sqrt{3}}=$ \hfill \sol{$2\sqrt{3}$}
    \end{enumerate}

    \item Calculeu els logaritmes.
    \begin{enumerate}[label=\alph*)]
    \item $\log_2 32=$ \hfill \sol{$5$}
    \item $\log_3 \dfrac{1}{9}=$ \hfill \sol{$-2$}
    \item $\log_5 \sqrt{5}=$ \hfill \sol{$\dfrac{1}{2}$}
    \item Si $\log_2 x = 6$, quant val $x$? \hfill \sol{$x=64$}
    \end{enumerate}

    \item Un cultiu de bacteris es duplica cada hora. Si comencem amb 5 bacteris, quantes hores trigarem a tenir-ne 320? \hfill \sol{6 hores}

    \item Un hort quadrat té una àrea de $72$ m$^2$. Quant mesura el costat? Escriu-lo com a radical simplificat. \hfill \sol{$6\sqrt{2}$ m}

    \item Troba totes les solucions de l'equació $x^2=49$. \hfill \sol{$x=\pm 7$}
\end{enumerate}
\end{document}
`;

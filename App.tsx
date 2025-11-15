import React, { useState, useEffect, useCallback, useRef } from 'react';
import { summarizeNewsWithGoogleSearch, generateSpeech } from './services/geminiService';
import { decode, decodeAudioData } from './utils/audio';
import type { Result, FavoriteItem } from './types';
import SpinnerIcon from './components/icons/SpinnerIcon';
import StarIcon from './components/icons/StarIcon';
import TrashIcon from './components/icons/TrashIcon';
import PlayIcon from './components/icons/PlayIcon';
import StopIcon from './components/icons/StopIcon';

type BackgroundTheme = 'light' | 'dark' | 'sepia';
type FontSize = 'medium' | 'large' | 'xlarge';
type ActiveView = 'feed' | 'discover' | 'favorites';

const fontSizeClassMap: Record<FontSize, string> = {
    medium: 'text-base',
    large: 'text-lg',
    xlarge: 'text-xl',
};

const themeStyles: Record<BackgroundTheme, { bg: string, text: string, cardBg: string, cardBorder: string, prose: string, subText: string, inputBg: string, hoverBg: string, activeTab: string, inactiveTab: string }> = {
    light: {
        bg: 'bg-gray-100',
        text: 'text-gray-800',
        cardBg: 'bg-white/50',
        cardBorder: 'border-gray-300',
        prose: '',
        subText: 'text-gray-500',
        inputBg: 'bg-gray-200',
        hoverBg: 'hover:bg-gray-300',
        activeTab: 'bg-white shadow text-gray-800',
        inactiveTab: 'text-gray-600 hover:bg-gray-200',
    },
    dark: {
        bg: 'bg-gray-900',
        text: 'text-gray-200',
        cardBg: 'bg-gray-800/50',
        cardBorder: 'border-gray-700',
        prose: 'prose-invert',
        subText: 'text-gray-400',
        inputBg: 'bg-gray-700/80',
        hoverBg: 'hover:bg-gray-600/80',
        activeTab: 'bg-gray-700 shadow text-gray-200',
        inactiveTab: 'text-gray-400 hover:bg-gray-700/80',
    },
    sepia: {
        bg: 'bg-[#fbf0e4]',
        text: 'text-[#5b4636]',
        cardBg: 'bg-[#f5e5d3]/50',
        cardBorder: 'border-[#dcd0c0]',
        prose: 'prose-sepia',
        subText: 'text-[#8d7966]',
        inputBg: 'bg-[#e9dac9]',
        hoverBg: 'hover:bg-[#dcd0c0]',
        activeTab: 'bg-[#f5e5d3] shadow text-[#5b4636]',
        inactiveTab: 'text-[#8d7966] hover:bg-[#e9dac9]',
    },
};


// A single result card component
const ResultCard: React.FC<{
    result: Result;
    onAddFavorite: (text: string, source: string, timestamp: number) => void;
    onDelete: (id: string) => void;
    isFavorited: (text: string) => boolean;
    fontSize: FontSize;
    theme: BackgroundTheme;
}> = ({ result, onAddFavorite, onDelete, isFavorited, fontSize, theme }) => {
    const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [audioError, setAudioError] = useState<string | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
    const styles = themeStyles[theme];

    const newsItems = result.summary
      .split('\n')
      .map(line => line.trim().replace(/^[-*]\s*|^\d+\.\s*/, ''))
      .filter(line => line.length > 0);


    const handleAudioAction = async () => {
        if (isPlaying) {
            sourceNodeRef.current?.stop();
            return;
        }

        if (!result.summary) return;
        setIsGeneratingAudio(true);
        setAudioError(null);
        
        try {
            const base64Audio = await generateSpeech(result.summary);

            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            }
            const audioContext = audioContextRef.current;

            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }

            const audioBytes = decode(base64Audio);
            const audioBuffer = await decodeAudioData(
                audioBytes,
                audioContext,
                24000, 
                1      
            );
            
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);

            sourceNodeRef.current = source;
            source.onended = () => {
                setIsPlaying(false);
                sourceNodeRef.current = null;
            };

            source.start();
            setIsPlaying(true);

        } catch (error) {
            console.error(error);
            setAudioError("Sesli brifing oluşturulamadı.");
            setIsPlaying(false);
        } finally {
            setIsGeneratingAudio(false);
        }
    };

    return (
        <div className={`${styles.cardBg} rounded-xl shadow-lg p-5 backdrop-blur-sm border ${styles.cardBorder} transition-all`}>
            <div className="flex justify-between items-start mb-3">
                <p className={`text-sm ${styles.subText}`}>
                    Kaynak: <span className={`font-semibold ${styles.text}`}>{result.source}</span>
                </p>
                <button onClick={() => onDelete(result.id)} title="Geçmişten sil" className={`${styles.subText} hover:text-red-500 transition-colors`}>
                    <TrashIcon className="w-6 h-6" />
                </button>
            </div>
            
            <div className={`space-y-3 prose ${styles.prose} max-w-none ${styles.text} whitespace-pre-wrap mb-4 ${fontSizeClassMap[fontSize]}`}>
                {newsItems.map((item, index) => (
                    <div key={index} className="flex items-start gap-3">
                        <button onClick={() => onAddFavorite(item, result.source, result.timestamp)} title="Favorilere ekle" className={`${styles.subText} hover:text-yellow-400 transition-colors pt-1`}>
                            <StarIcon filled={isFavorited(item)} className="w-5 h-5" />
                        </button>
                        <p className="flex-1">{item}</p>
                    </div>
                ))}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                 <button 
                    onClick={handleAudioAction}
                    disabled={isGeneratingAudio}
                    className="flex items-center justify-center px-4 py-2 w-48 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 dark:focus:ring-offset-gray-800 focus:ring-teal-500 disabled:bg-gray-400 dark:disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
                >
                    {isGeneratingAudio ? <SpinnerIcon className="w-4 h-4 mr-2" /> : (isPlaying ? <StopIcon className="w-5 h-5 mr-2" /> : <PlayIcon className="w-5 h-5 mr-2" />)}
                    {isGeneratingAudio ? "Oluşturuluyor..." : (isPlaying ? "Durdur" : "Sesli Brifing Dinle")}
                </button>
            </div>
            
            {audioError && <p className="text-red-500 dark:text-red-400 text-sm mt-2">{audioError}</p>}
            
            {result.groundingChunks.length > 0 && (
                <div className={`mt-4 border-t ${styles.cardBorder} pt-3`}>
                    <h4 className={`text-sm font-semibold mb-2 ${styles.subText}`}>İlgili Bağlantılar</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                        {result.groundingChunks.filter(c => c.web).map((chunk, index) => (
                            <li key={index}>
                                <a href={chunk.web?.uri} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline">
                                    {chunk.web?.title}
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

const countries = ["Dünya", "Türkiye", "ABD", "Almanya", "İngiltere", "Fransa", "Japonya", "Rusya", "Çin"];
const categories = ["Gündem", "Son Dakika", "Spor", "Teknoloji", "Bilim", "Sanat", "Sağlık", "Eğlence"];
const discoverCategories = ["Yorum & Analiz", "Edebiyat & Sanat", "Felsefe", "Popüler Bilim", "Siyaset", "Din", "Sinema", "Toplum", "Psikoloji", "Hukuk"];


// Main App component
const App: React.FC = () => {
    const [history, setHistory] = useState<Result[]>([]);
    const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
    const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [backgroundTheme, setBackgroundTheme] = useState<BackgroundTheme>('light');
    const [fontSize, setFontSize] = useState<FontSize>('medium');
    const [activeView, setActiveView] = useState<ActiveView>('feed');

    // Load settings from localStorage
    useEffect(() => {
        const savedTheme = localStorage.getItem('backgroundTheme') as BackgroundTheme | null;
        let savedFontSize = localStorage.getItem('fontSize') as FontSize | null;
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        setBackgroundTheme(savedTheme || (prefersDark ? 'dark' : 'light'));

        if (savedFontSize === ('small' as any)) {
            savedFontSize = 'medium';
            localStorage.setItem('fontSize', 'medium');
        }
        setFontSize(savedFontSize || 'medium');
    }, []);

    // Save settings to localStorage
    useEffect(() => {
        localStorage.setItem('backgroundTheme', backgroundTheme);
        localStorage.setItem('fontSize', fontSize);
    }, [backgroundTheme, fontSize]);

    // Load history and favorites from localStorage
    useEffect(() => {
        try {
            const savedHistory = localStorage.getItem('newsBriefingHistory');
            if (savedHistory) setHistory(JSON.parse(savedHistory));
            const savedFavorites = localStorage.getItem('newsBriefingFavorites');
            if (savedFavorites) setFavorites(JSON.parse(savedFavorites));
        } catch (e) {
            console.error("Failed to load data from localStorage", e);
        }
    }, []);

    // Save history and favorites to localStorage
    useEffect(() => {
        try {
            localStorage.setItem('newsBriefingHistory', JSON.stringify(history));
            localStorage.setItem('newsBriefingFavorites', JSON.stringify(favorites));
        } catch (e) {
            console.error("Failed to save data to localStorage", e);
        }
    }, [history, favorites]);

    const handleGetSummary = async () => {
        if (!selectedCountry || !selectedCategory) {
            setError("Lütfen bir ülke ve kategori seçin.");
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const prompt = `Lütfen ${selectedCountry === 'Dünya' ? 'dünyadaki' : `${selectedCountry} ülkesindeki`} en güncel ${selectedCategory} haberlerini özetle. Özetini oluştururken, farklı bakış açıları sunan birden çok çeşitli ve güvenilir web kaynağını kullandığından emin ol. Sonucu Türkçe olarak maddeler halinde sun.`;
            const { summary, groundingChunks } = await summarizeNewsWithGoogleSearch(prompt);
            const newResult: Result = {
                id: new Date().toISOString(),
                source: `${selectedCountry} - ${selectedCategory}`,
                summary,
                groundingChunks,
                timestamp: Date.now()
            };
            setHistory(prevHistory => [newResult, ...prevHistory]);
        } catch (err) {
            console.error(err);
            setError("Haber özeti alınırken bir hata oluştu. Lütfen tekrar deneyin.");
        } finally {
            setIsLoading(false);
        }
    };
    
     const handleGetDiscovery = async (category: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const prompt = `"${category}" alanında, dünya çapında saygın düşünce liderlerinden, eleştirmenlerden veya sanatçılardan ufuk açıcı, güncel bir deneme, analiz veya eleştiri yazısı bul ve bunu Türkçe olarak, ana fikirlerini ve temel argümanlarını vurgulayarak maddeler halinde özetle. Özetini oluştururken, farklı bakış açıları sunan çeşitli ve güvenilir web kaynaklarını kullandığından emin ol.`;
            const { summary, groundingChunks } = await summarizeNewsWithGoogleSearch(prompt);
            const newResult: Result = {
                id: new Date().toISOString(),
                source: `Keşfet - ${category}`,
                summary,
                groundingChunks,
                timestamp: Date.now()
            };
            setHistory(prevHistory => [newResult, ...prevHistory]);
            setActiveView('feed');
        } catch (err) {
            console.error(err);
            setError("İçerik getirilirken bir hata oluştu. Lütfen tekrar deneyin.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddFavorite = useCallback((text: string, source: string, timestamp: number) => {
        setFavorites(prev => {
            const exists = prev.some(item => item.text === text);
            if (exists) {
                return prev.filter(item => item.text !== text);
            } else {
                const newFavorite: FavoriteItem = { id: new Date().toISOString(), text, source, timestamp };
                return [newFavorite, ...prev];
            }
        });
    }, []);
    
    const handleRemoveFavorite = useCallback((id: string) => {
        setFavorites(prev => prev.filter(item => item.id !== id));
    }, []);

    const handleDeleteResult = useCallback((id:string) => {
        setHistory(prev => prev.filter(item => item.id !== id));
    }, []);

    const isFavoritedCheck = useCallback((text: string) => {
        return favorites.some(fav => fav.text === text);
    }, [favorites]);

    const sortedHistory = history.sort((a,b) => b.timestamp - a.timestamp);
    const sortedFavorites = favorites.sort((a,b) => b.timestamp - a.timestamp);

    const styles = themeStyles[backgroundTheme];

    return (
        <div className={`min-h-screen ${styles.bg} ${styles.text} flex flex-col items-center p-4 sm:p-6 lg:p-8 font-sans`}>
            <div className="w-full max-w-4xl mx-auto">
                <header className="text-center mb-6">
                    <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-teal-400 dark:from-blue-400 dark:to-teal-300">
                        Gündem Asistanı
                    </h1>
                    <p className={`${styles.subText} mt-2`}>Anlık haber özetleri ve ufuk açan içerikleri keşfedin.</p>
                </header>

                <div className="flex justify-center items-center gap-4 flex-wrap mb-8">
                    <div className={`flex items-center p-1 rounded-full text-xs font-semibold ${styles.inputBg}`}>
                       <button onClick={() => setBackgroundTheme('light')} className={`px-3 py-1 rounded-full ${backgroundTheme === 'light' ? 'bg-white shadow text-gray-800' : 'text-gray-600'}`}>Açık</button>
                       <button onClick={() => setBackgroundTheme('sepia')} className={`px-3 py-1 rounded-full ${backgroundTheme === 'sepia' ? 'bg-[#e9dac9] shadow text-[#5b4636]' : 'text-gray-500'}`}>Sepya</button>
                       <button onClick={() => setBackgroundTheme('dark')} className={`px-3 py-1 rounded-full ${backgroundTheme === 'dark' ? 'bg-gray-700 shadow text-gray-200' : 'text-gray-400'}`}>Siyah</button>
                    </div>
                     <div className={`flex items-center p-1 rounded-full font-semibold ${styles.inputBg}`}>
                       <button onClick={() => setFontSize('medium')} className={`px-3 py-1 rounded-full text-sm ${fontSize === 'medium' ? (backgroundTheme === 'dark' ? 'bg-gray-700 shadow' : 'bg-white shadow') : ''}`}>A</button>
                       <button onClick={() => setFontSize('large')} className={`px-3 py-1 rounded-full text-base ${fontSize === 'large' ? (backgroundTheme === 'dark' ? 'bg-gray-700 shadow' : 'bg-white shadow') : ''}`}>A</button>
                       <button onClick={() => setFontSize('xlarge')} className={`px-3 py-1 rounded-full text-lg ${fontSize === 'xlarge' ? (backgroundTheme === 'dark' ? 'bg-gray-700 shadow' : 'bg-white shadow') : ''}`}>A</button>
                    </div>
                </div>

                <main>
                    <div className={`flex items-center justify-center mb-6 p-1 rounded-full ${styles.inputBg}`}>
                        <button onClick={() => setActiveView('feed')} className={`w-1/3 py-2 text-sm font-semibold rounded-full transition-colors ${activeView === 'feed' ? styles.activeTab : styles.inactiveTab}`}>
                           Haber Akışı
                        </button>
                        <button onClick={() => setActiveView('discover')} className={`w-1/3 py-2 text-sm font-semibold rounded-full transition-colors ${activeView === 'discover' ? styles.activeTab : styles.inactiveTab}`}>
                           Keşfet
                        </button>
                        <button onClick={() => setActiveView('favorites')} className={`w-1/3 py-2 text-sm font-semibold rounded-full transition-colors ${activeView === 'favorites' ? styles.activeTab : styles.inactiveTab}`}>
                            Favoriler
                        </button>
                    </div>

                    {activeView === 'feed' && (
                        <>
                        <div className={`${styles.cardBg} rounded-2xl shadow-lg p-6 backdrop-blur-sm border ${styles.cardBorder} space-y-6`}>
                            <div>
                                <h3 className={`text-lg font-medium ${styles.text} mb-3`}>Ülke</h3>
                                <div className="flex flex-wrap gap-3">
                                    {countries.map(country => (
                                        <button 
                                            key={country} 
                                            onClick={() => setSelectedCountry(country)}
                                            className={`px-4 py-2 text-sm font-semibold rounded-full transition-all duration-200 ${
                                                selectedCountry === country 
                                                    ? 'bg-blue-600 text-white shadow-lg ring-2 ring-blue-400' 
                                                    : `${styles.inputBg} ${styles.text} ${styles.hoverBg}`
                                            }`}
                                        >
                                            {country}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            <div>
                                 <h3 className={`text-lg font-medium ${styles.text} mb-3`}>Kategori</h3>
                                <div className="flex flex-wrap gap-3">
                                    {categories.map(category => (
                                        <button 
                                            key={category} 
                                            onClick={() => setSelectedCategory(category)}
                                            className={`px-4 py-2 text-sm font-semibold rounded-full transition-all duration-200 ${
                                                selectedCategory === category 
                                                    ? 'bg-teal-600 text-white shadow-lg ring-2 ring-teal-400' 
                                                    : `${styles.inputBg} ${styles.text} ${styles.hoverBg}`
                                            }`}
                                        >
                                            {category}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            <div className={`border-t ${styles.cardBorder} pt-6`}>
                                <button 
                                    onClick={handleGetSummary}
                                    disabled={isLoading || !selectedCountry || !selectedCategory} 
                                    className="w-full flex items-center justify-center bg-blue-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 dark:focus:ring-offset-gray-800 focus:ring-blue-500 disabled:bg-gray-400 dark:disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
                                >
                                    {isLoading && <SpinnerIcon className="w-5 h-5 mr-2" />}
                                    {isLoading ? "Özetleniyor..." : "Özet Getir"}
                                </button>
                                {error && <p className="text-red-500 dark:text-red-400 mt-3 text-center">{error}</p>}
                            </div>
                        </div>
                        {sortedHistory.length > 0 && (
                            <section className="mt-8 space-y-4">
                                {sortedHistory.map(result => (
                                    <ResultCard key={result.id} result={result} onAddFavorite={handleAddFavorite} onDelete={handleDeleteResult} isFavorited={isFavoritedCheck} fontSize={fontSize} theme={backgroundTheme} />
                                ))}
                            </section>
                        )}
                        </>
                    )}
                     
                    {activeView === 'discover' && (
                        <section>
                            <div className={`${styles.cardBg} rounded-2xl shadow-lg p-6 backdrop-blur-sm border ${styles.cardBorder} space-y-6`}>
                                <div>
                                    <h3 className={`text-lg font-medium ${styles.text} mb-2`}>Keşfet</h3>
                                    <p className={`${styles.subText} mb-4 text-sm`}>Aşağıdaki konulardan birini seçerek dünya çapındaki güncel düşünce, sanat ve eleştiri yazılarını keşfedin.</p>
                                    <div className="flex flex-wrap gap-3">
                                        {discoverCategories.map(category => (
                                            <button 
                                                key={category} 
                                                onClick={() => handleGetDiscovery(category)}
                                                disabled={isLoading}
                                                className="px-4 py-2 text-sm font-semibold rounded-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed bg-purple-600 text-white hover:bg-purple-700 flex items-center justify-center"
                                            >
                                                 {isLoading ? <SpinnerIcon className="w-5 h-5" /> : category}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {error && <p className="text-red-500 dark:text-red-400 mt-3 text-center">{error}</p>}
                            </div>
                        </section>
                    )}

                    {activeView === 'favorites' && (
                        <section>
                             <h2 className="text-2xl font-semibold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-orange-500 dark:from-yellow-400 dark:to-orange-400">Favori Haberler</h2>
                             {sortedFavorites.length > 0 ? (
                                <div className="space-y-4">
                                    {sortedFavorites.map(fav => (
                                        <div key={fav.id} className={`${styles.cardBg} rounded-xl shadow-lg p-5 backdrop-blur-sm border ${styles.cardBorder}`}>
                                            <p className={`mb-3 ${fontSizeClassMap[fontSize]}`}>{fav.text}</p>
                                            <div className="flex justify-between items-center border-t border-gray-200 dark:border-gray-700 pt-3">
                                                <div className={`text-xs ${styles.subText}`}>
                                                    <p>{fav.source}</p>
                                                    <p>{new Date(fav.timestamp).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                                </div>
                                                 <button onClick={() => handleRemoveFavorite(fav.id)} title="Favorilerden kaldır" className={`${styles.subText} hover:text-red-500 transition-colors`}>
                                                    <TrashIcon className="w-6 h-6" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                             ) : (
                                <p className={`${styles.subText} text-center py-8`}>Henüz favori haberiniz bulunmuyor.</p>
                             )}
                        </section>
                    )}
                </main>
            </div>
        </div>
    );
};

export default App;
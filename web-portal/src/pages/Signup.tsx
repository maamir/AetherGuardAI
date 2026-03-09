import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Mail, Lock, Building, User, Check } from 'lucide-react';

const TIERS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    requests: '10K/month',
    rateLimit: '10 req/sec',
    features: ['Basic security', 'PII detection', 'Email support'],
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 99,
    requests: '1M/month',
    rateLimit: '100 req/sec',
    features: ['All Free features', 'Toxicity filtering', 'Hallucination detection', 'Chat support'],
    popular: true,
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 499,
    requests: '10M/month',
    rateLimit: '1000 req/sec',
    features: ['All Starter features', 'Custom models', 'SSO integration', 'Priority support'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: null,
    requests: 'Unlimited',
    rateLimit: '10000 req/sec',
    features: ['All Professional features', 'Dedicated support', 'Custom deployment'],
  },
];

export default function Signup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [selectedTier, setSelectedTier] = useState('starter');
  const [formData, setFormData] = useState({
    companyName: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    industry: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('http://localhost:8080/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, tier: selectedTier }),
      });

      if (!response.ok) throw new Error('Signup failed');

      const data = await response.json();
      localStorage.setItem('token', data.token);
      navigate('/onboarding');
    } catch (err) {
      alert('Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(to bottom right, #eff6ff, #e0e7ff)',
      padding: '3rem 1rem'
    }}>
      <div style={{ maxWidth: '80rem', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '4rem',
            height: '4rem',
            background: '#2563eb',
            borderRadius: '50%',
            marginBottom: '1rem'
          }}>
            <Shield style={{ width: '2rem', height: '2rem', color: 'white' }} />
          </div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 'bold', color: '#111827' }}>
            Get Started with AetherGuard AI
          </h1>
          <p style={{ color: '#6b7280', marginTop: '0.5rem' }}>
            Choose your plan and create your account
          </p>
        </div>

        {/* Progress Steps */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '2rem',
          gap: '1rem',
          alignItems: 'center'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            color: step >= 1 ? '#2563eb' : '#9ca3af'
          }}>
            <div style={{
              width: '2rem',
              height: '2rem',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: step >= 1 ? '#2563eb' : '#d1d5db',
              color: 'white',
              fontWeight: '500'
            }}>
              1
            </div>
            <span style={{ marginLeft: '0.5rem', fontWeight: '500' }}>Choose Plan</span>
          </div>
          <div style={{ width: '4rem', height: '2px', background: '#d1d5db' }}></div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            color: step >= 2 ? '#2563eb' : '#9ca3af'
          }}>
            <div style={{
              width: '2rem',
              height: '2rem',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: step >= 2 ? '#2563eb' : '#d1d5db',
              color: 'white',
              fontWeight: '500'
            }}>
              2
            </div>
            <span style={{ marginLeft: '0.5rem', fontWeight: '500' }}>Account Details</span>
          </div>
        </div>

        {step === 1 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2rem'
          }}>
            {TIERS.map((tier) => (
              <div
                key={tier.id}
                onClick={() => setSelectedTier(tier.id)}
                style={{
                  background: 'white',
                  borderRadius: '1rem',
                  padding: '1.5rem',
                  cursor: 'pointer',
                  border: selectedTier === tier.id ? '2px solid #2563eb' : '1px solid #e5e7eb',
                  boxShadow: selectedTier === tier.id ? '0 10px 15px -3px rgba(0, 0, 0, 0.1)' : 'none',
                  position: 'relative'
                }}
              >
                {tier.popular && (
                  <div style={{
                    position: 'absolute',
                    top: '-0.75rem',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#2563eb',
                    color: 'white',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: '500'
                  }}>
                    Popular
                  </div>
                )}
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  {tier.name}
                </h3>
                <div style={{ marginBottom: '1rem' }}>
                  {tier.price === null ? (
                    <span style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>Custom</span>
                  ) : (
                    <>
                      <span style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>${tier.price}</span>
                      <span style={{ color: '#6b7280' }}>/month</span>
                    </>
                  )}
                </div>
                <div style={{ marginBottom: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                  <div><strong>{tier.requests}</strong> requests</div>
                  <div><strong>{tier.rateLimit}</strong> rate limit</div>
                </div>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {tier.features.map((feature, idx) => (
                    <li key={idx} style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      fontSize: '0.875rem',
                      color: '#6b7280',
                      marginBottom: '0.5rem'
                    }}>
                      <Check style={{
                        width: '1rem',
                        height: '1rem',
                        color: '#10b981',
                        marginRight: '0.5rem',
                        flexShrink: 0,
                        marginTop: '0.125rem'
                      }} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {step === 2 && (
          <div style={{
            maxWidth: '48rem',
            margin: '0 auto',
            background: 'white',
            borderRadius: '1rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            padding: '2rem'
          }}>
            <form onSubmit={handleSubmit}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '1.5rem',
                marginBottom: '1.5rem'
              }}>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    marginBottom: '0.5rem'
                  }}>
                    Company Name
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Building style={{
                      position: 'absolute',
                      left: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '1.25rem',
                      height: '1.25rem',
                      color: '#9ca3af'
                    }} />
                    <input
                      type="text"
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      style={{
                        width: '100%',
                        paddingLeft: '2.5rem',
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem'
                      }}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    marginBottom: '0.5rem'
                  }}>
                    Industry
                  </label>
                  <select
                    value={formData.industry}
                    onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem'
                    }}
                    required
                  >
                    <option value="">Select industry</option>
                    <option value="technology">Technology</option>
                    <option value="finance">Finance</option>
                    <option value="healthcare">Healthcare</option>
                    <option value="retail">Retail</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    marginBottom: '0.5rem'
                  }}>
                    First Name
                  </label>
                  <div style={{ position: 'relative' }}>
                    <User style={{
                      position: 'absolute',
                      left: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '1.25rem',
                      height: '1.25rem',
                      color: '#9ca3af'
                    }} />
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      style={{
                        width: '100%',
                        paddingLeft: '2.5rem',
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem'
                      }}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    marginBottom: '0.5rem'
                  }}>
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem'
                    }}
                    required
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    marginBottom: '0.5rem'
                  }}>
                    Email Address
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail style={{
                      position: 'absolute',
                      left: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '1.25rem',
                      height: '1.25rem',
                      color: '#9ca3af'
                    }} />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      style={{
                        width: '100%',
                        paddingLeft: '2.5rem',
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem'
                      }}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    marginBottom: '0.5rem'
                  }}>
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem'
                    }}
                    required
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    marginBottom: '0.5rem'
                  }}>
                    Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock style={{
                      position: 'absolute',
                      left: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '1.25rem',
                      height: '1.25rem',
                      color: '#9ca3af'
                    }} />
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      style={{
                        width: '100%',
                        paddingLeft: '2.5rem',
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem'
                      }}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    marginBottom: '0.5rem'
                  }}>
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem'
                    }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem' }}>
                <input type="checkbox" style={{ width: '1rem', height: '1rem' }} required />
                <span style={{ marginLeft: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
                  I agree to the <a href="/terms" style={{ color: '#2563eb' }}>Terms of Service</a> and{' '}
                  <a href="/privacy" style={{ color: '#2563eb' }}>Privacy Policy</a>
                </span>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  style={{
                    flex: 1,
                    padding: '0.75rem 1.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    background: 'white',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    flex: 1,
                    background: loading ? '#93c5fd' : '#2563eb',
                    color: 'white',
                    padding: '0.75rem 1.5rem',
                    borderRadius: '0.5rem',
                    fontWeight: '500',
                    border: 'none',
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {loading ? 'Creating Account...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        )}

        {step === 1 && (
          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <button
              onClick={() => setStep(2)}
              style={{
                background: '#2563eb',
                color: 'white',
                padding: '0.75rem 2rem',
                borderRadius: '0.5rem',
                fontWeight: '500',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1rem'
              }}
            >
              Continue to Account Details
            </button>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
            Already have an account?{' '}
            <a href="/login" style={{
              color: '#2563eb',
              textDecoration: 'none',
              fontWeight: '500'
            }}>
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
